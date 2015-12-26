var session,status,xml4kdb,rawtags,processTags,storeFields;
var tokenize,normalize,isSkip;


var isCSV=function(fn) {
	return (fn.substr(fn.length-4).toLowerCase()===".csv") ;
}
var isTSV=function(fn) {
	return (fn.substr(fn.length-4).toLowerCase()===".tsv") ;
}
var resolveTagsVpos=function(parsed) {
	for (var i=0;i<parsed.tags.length;i++) {
		for (var j=0;j<parsed.tags[i].length;j++) {
			var t=parsed.tags[i][j];
			var pos=t[0];
			t[3]=parsed.tovpos[i][pos];
			while (pos && typeof t[3]=="undefined") t[3]=parsed.tovpos[i][--pos];
		}
	}
}
var putPosting=function(tk,vpos) {
	var	postingid=session.json.tokens[tk];
	var out=session.json, posting=null;
	if (!postingid) {
		out.postingcount++;
		posting=out.postings[out.postingcount]=[];
		session.json.tokens[tk]=out.postingcount;
		session.json._tokenids.push([tk,out.postingcount]);
	} else {
		posting=out.postings[postingid];
	}
	posting.push(vpos||session.vpos);
}


var indexOfSorted = function (array, obj) {
  var low = 0,
  high = array.length-1;
  while (low < high) {
    var mid = (low + high) >> 1;
    array[mid] < obj ? low = mid + 1 : high = mid;
  }
  return low;
};

var putBigram=function(bi,vpos) {
	var i=indexOfSorted(session.config.meta.bigram,bi);
	if (i>-1 && session.config.meta.bigram[i]==bi) {
		putPosting(bi,vpos);
	}
}
var lastnormalized="", lastnormalized_vpos=0;
var putSegment=function(inscription) {
	var tokenized=tokenize(inscription);
	var tokenOffset=0, tovpos=[] ;
	for (var i=0;i<tokenized.tokens.length;i++) {
		var t=tokenized.tokens[i];
		tovpos[tokenOffset]=session.vpos;
		tokenOffset+=t.length;
		if (isSkip(t)) {
			 session.vpos--;
		} else {
			var normalized=normalize(t);
			var c=normalized.charCodeAt(0);
			if (normalized) {
				putPosting(normalized,session.vpos);
				if (lastnormalized_vpos+1==session.vpos &&  lastnormalized && session.config.meta && session.config.meta.bigram) {
					putBigram(lastnormalized+normalized,lastnormalized_vpos);
				}
				lastnormalized_vpos=session.vpos;
			}
			lastnormalized=normalized;
 		}
 		session.vpos++;
	}
	tovpos[tokenOffset]=session.vpos;
	session.indexedTextLength+= inscription.length;
	return tovpos;
}

var shortFilename=function(fn) {
	fn=fn.replace(/\\/g,'/');
	var arr=fn.split('/');
	while (arr.length>2) arr.shift();
	return arr.join('/');
}

var putFileInfo=function(filecontent) {
	var shortfn=shortFilename(status.filename);
	//session.json.files.push(fileInfo);
	//empty or first line empty
	session.json.filecontents.push(filecontent);
	session.json.filenames.push(shortfn);
	session.json.fileoffsets.push(session.vpos);
	//fileInfo.segOffset.push(session.vpos);
}

var putSegments=function(parsed,cb) { //25% faster than create a new document
	//var fileInfo={segnames:[],segOffset:[]};
	var filecontent=[];
	parsed.tovpos=[];
	sepTagname=parsed.sepTagname;
	putFileInfo(filecontent);
	for (var i=0;i<parsed.texts.length;i++) {
		var t=parsed.texts[i];
		session.json.segoffsets.push(session.vpos);
		filecontent.push(t.t);

		if (!session.config.norawtag && parsed.tags[i].length) {
			rawtags.emit(session.json.segnames.length,parsed.tags[i]);
		}

		var tovpos=putSegment(t.t);
		parsed.tovpos[i]=tovpos;
		if (!session.config.meta.txtid) { //default txtid to segname
			if (typeof session.json._txtid[t.n]!=="undefined") { //auto resolve duplicate id by appeding seq number
				var seq=1;
				while (typeof session.json._txtid[t.n+"@"+seq]!=="undefined") {
					seq++;
				}
				console.log("\nrepeated txtid",t.n,"changed to",t.n+"@"+seq);
				t.n+="@"+seq;
			}
			session.json._txtid[t.n]=session.json.segnames.length;
		}
		session.json.segnames.push(t.n);
	}
	var lastfilecount=0;
	if (session.json.filesegcount.length) lastfilecount=session.json.filesegcount[session.json.filesegcount.length-1];
	session.json.filesegcount.push(lastfilecount+parsed.texts.length); //accurate seg count

	if (filecontent.length==0 || (filecontent.length==1&&!filecontent[0])) {
		console.log("no content in"+status.filename);
		filecontent[0]=" "; //work around to avoid empty string array throw in kdbw
	}

	cb(parsed);//finish
}
var parseBody=function(body,segsep,cb) {
	var res=xml4kdb.parseXML(body,
		{segsep:segsep,maxsegsize:session.config.maxsegsize,
			callbacks:session.config.callbacks||{},
			trim:!!session.config.trim, csv:isCSV(status.filename), tsv:isTSV(status.filename)});
	putSegments(res,cb);
	status.segCount+=res.texts.length;//dnew.segCount;
}

var putFile=function(fn,cb) {
	var fs=require("fs");
	if (!fs.existsSync(fn)){
		if (fn) console.warn("file ",fn,"doens't exist");
		cb();
		return;
	}
	var texts=fs.readFileSync(fn,session.config.inputEncoding).replace(/\r\n/g,"\n");
	if (texts.charCodeAt(0)==0xfeff) {
		texts=texts.substring(1);
	}
	var bodyend=session.config.bodyend;
	var bodystart=session.config.bodystart;
	var captureTags=session.config.captureTags;
	var callbacks=session.config.callbacks||{};
	var started=false,stopped=false;
	if (callbacks.beforeFile) {
		texts=callbacks.beforeFile.apply(session,[texts,fn]);
	}
	if (callbacks.onFile) {
		var fields=callbacks.onFile.apply(session,[fn,status,session]);
		fields && storeFields(fields,session.json);
	}
	else console.log("indexing",fn);

	var start=bodystart ? texts.indexOf(bodystart) : 0 ;
	var end=bodyend? texts.indexOf(bodyend): texts.length;
	if (!bodyend) bodyendlen=0;
	else bodyendlen=bodyend.length;
	//assert.equal(end>start,true);

	// split source xml into 3 parts, before <body> , inside <body></body> , and after </body>
	var body=texts.substring(start,end+bodyendlen);
	status.json=session.json;

	status.bodytext=body;
	status.starttext=texts.substring(0,start);
	status.fileStartVpos=session.vpos;

	if (callbacks.beforebodystart) callbacks.beforebodystart.apply(session,[texts.substring(0,start),status]);
	
	parseBody(body,session.config.segsep,function(parsed){
		status.parsed=parsed;
		resolveTagsVpos(parsed);
		if (captureTags) {
			processTags(callbacks,captureTags, parsed.tags, parsed.texts);
		}
		var ending="";
		if (bodyend) ending=texts.substring(end+bodyend.length);
		if (ending && callbacks.afterbodyend) {
			callbacks.afterbodyend.apply(session,[ending,status]);
		}
		status.parsed=null;
		status.bodytext=null;
		status.starttext=null;
		status.json=null;
		cb(); //parse body finished
	});
}

var init=function(api,_session,_status,_xml4kdb,_rawtags,_processTags,_storeFields){
	session=_session;
	status=_status;
	xml4kdb=_xml4kdb;
	rawtags=_rawtags;
	processTags=_processTags;

	normalize=api["normalize"];
	isSkip=api["isSkip"];
	tokenize=api["tokenize"];
	storeFields=_storeFields;
}
module.exports={putFile:putFile,init:init};