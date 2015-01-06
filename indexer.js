var indexing=false; //only allow one indexing task
var status={segCount:0,progress:0,done:false}; //progress ==1 completed
var session={};
var api=null;
var xml4kdb=null;
var isSkip=null;
var normalize=null;
var tokenize=null;

//
var requireLocal=function(module) {
	if (module[0]!=".") module="../node_modules/"+module+"/index.js";
	return require(require("path").resolve(process.cwd(),module));
}
var putPosting=function(tk,vpos) {
	var	postingid=session.json.tokens[tk];
	var out=session.json, posting=null;
	if (!postingid) {
		out.postingcount++;
		posting=out.postings[out.postingcount]=[];
		session.json.tokens[tk]=out.postingcount;
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
			if (normalized) {
				putPosting(normalized);
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
		filecontent.push(t.t);

		var tovpos=putSegment(t.t);
		parsed.tovpos[i]=tovpos;
		session.json.segnames.push(t.n);
		session.json.segoffsets.push(session.vpos);
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

var parseBody=function(body,sep,cb) {
	var res=xml4kdb.parseXML(body, {sep:sep,trim:!!session.config.trim});
	putSegments(res,cb);
	status.segCount+=res.texts.length;//dnew.segCount;
}

var pat=/([a-zA-Z:]+)="([^"]+?)"/g;
var parseAttributesString=function(s) {
	if (!s) return "";
	var out={};
	//work-around for repeated attribute,
	//take the first one
	s.replace(pat,function(m,m1,m2){if (!out[m1]) out[m1]=m2});
	return out;
}
var storeFields=function(fields,json) {
	if (!json.fields) json.fields={};
	var root=json.fields;
	if (!(fields instanceof Array) ) fields=[fields];
	var storeField=function(field) {
		var path=field.path;
		storepoint=root;
		if (!(path instanceof Array)) path=[path];
		for (var i=0;i<path.length;i++) {
			if (!storepoint[path[i]]) {
				if (i<path.length-1) storepoint[path[i]]={};
				else storepoint[path[i]]=[];
			}
			storepoint=storepoint[path[i]];
		}
		if (typeof field.value=="undefined") {
			throw "empty field value of ["+path+"] in file "+status.filename;
		} 
		storepoint.push(field.value);
	}
	fields.map(storeField);
}
/*
	maintain a tag stack for known tag
*/
var tagStack=[],sepTagname="";
var processTags=function(callbacks,captureTags,tags,texts) {
	var getTextBetween=function(from,to,startoffset,endoffset) {
		if (from==to) return texts[from].t.substring(startoffset,endoffset);
		var first=texts[from].t.substr(startoffset-1);
		var middle="";
		for (var i=from+1;i<to;i++) {
			middle+=texts[i].t;
		}
		var last=texts[to].t.substr(0,endoffset-1);
		return first+middle+last;
	}

	var processTag=function(ntext){
		var prev=tagStack[tagStack.length-1];
		var text="";
		if (!nulltag) {
			if (typeof prev=="undefined" || tagname.substr(1)!=prev[0]) {
				console.error("tag unbalance",tagname,prev,status.filename);						
				throw "tag unbalance";
			} else {
				tagStack.pop();
				text=getTextBetween(prev[3],ntext,prev[1],tagoffset);						
				//console.log(text,prev[1],tagoffset)
			}
		}
		if (typeof prev=="undefined") {
			status.vpos=tagvpos;
		} else {
			status.vpos=tagvpos; 
			status.vposstart=prev[4];
			if (!attr) attr=prev[2]; //use attribute from open tag
		}
		status.tagStack=tagStack;

		var fields=handler(text, tagname, attr, status);
		if (fields) storeFields(fields,session.json);
	}
	var attr=null;
	for (var i=0;i<tags.length;i++) {
		for (var j=0;j<tags[i].length;j++) {
			var T=tags[i][j],tagname=T[1],tagoffset=T[0],attributes=T[2],tagvpos=T[3];
			var lastchar=attributes[attributes.length-1];
			var nulltag=false;
			if (typeof lastchar!="undefined") {
				if (lastchar=="/") {
					nulltag=true;
				} else {
					var lastcc=lastchar.charCodeAt(0);
					if (!(lastchar=='"' ||lastchar=='-'|| (lastcc>0x40 && lastcc<0x7b))) {
						console.error("error lastchar of tag ("+lastchar+")");
						console.error("in <"+tagname,attributes+"> of",status.filename)	;
						throw 'last char of should be / " or ascii ';
					}
				}
			}
			var handler=null;
			if (tagname[0]=="/") handler=captureTags[tagname.substr(1)];
			else if (nulltag) handler=captureTags[tagname];

			attr=parseAttributesString(attributes);

			if (!nulltag) {
				tagStack.push([tagname,tagoffset,attr,i, tagvpos]);
			}
		
			if (handler) processTag(i);
			if (callbacks.getSegName && tagname==sepTagname){
				session.json.segnames[i]=callbacks.getSegName(status);
			}

		}	
	}
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
	if (callbacks.onFile) callbacks.onFile.apply(session,[fn,status]);
	else console.log("indexing",fn);

	var start=bodystart ? texts.indexOf(bodystart) : 0 ;
	var end=bodyend? texts.indexOf(bodyend): texts.length;
	if (!bodyend) bodyendlen=0;
	else bodyendlen=bodyend.length;
	//assert.equal(end>start,true);

	// split source xml into 3 parts, before <body> , inside <body></body> , and after </body>
	var body=texts.substring(start,end+bodyendlen);
	status.json=session.json;
	status.storeFields=storeFields;
	
	status.bodytext=body;
	status.starttext=texts.substring(0,start);
	status.fileStartVpos=session.vpos;

	if (callbacks.beforebodystart) callbacks.beforebodystart.apply(session,[texts.substring(0,start),status]);
	var sep=session.config.segsep;
	parseBody(body,sep,function(parsed){
		status.parsed=parsed;
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
var initSession=function(config) {
	var json={
		postings:[[0]] //first one is always empty, because tokenid cannot be 0
		,postingcount:0
		,filecontents:[]
		,filenames:[]
		,fileoffsets:[]
		,filesegcount:[] //2014/11/26
		,segnames:[]
		,segoffsets:[]
		,tokens:{}
	};
	config.inputEncoding=config.inputEncoding||"utf8";
	var session={vpos:1, json:json , kdb:null, filenow:0,done:false
		           ,indexedTextLength:0,config:config,files:config.files,segcount:0};
	return session;
}

var mergemixin=function(config){
	if (!config.mixin) return;
	var mixins=requireLocal("ksana-indexer").mixins;
	var mixin=mixins[config.mixin];
	if (!mixin) return;

	for (var i in mixin) {
		if (!config[i]) config[i]=mixin[i];//overwrite
		else {
			if (typeof config[i]=="object") {
				for (var j in config[i]) {
					if (!config[i][j]) config[i][j]=mixin[i][j];
				}
			}
		}
	}
}
var initIndexer=function(mkdbconfig) {
	session=initSession(mkdbconfig);

	mergemixin(mkdbconfig);
	var analyzer=requireLocal("ksana-analyzer");
	api=analyzer.getAPI(mkdbconfig.meta.config);
	
	xml4kdb=requireLocal("ksana-indexer").xml4kdb;

	//mkdbconfig has a chance to overwrite API
	if (mkdbconfig.meta && mkdbconfig.meta.normalize) {
		api.setNormalizeTable(mkdbconfig.meta.normalize);
	}
	normalize=api["normalize"];
	isSkip=api["isSkip"];
	tokenize=api["tokenize"];

	var folder=session.config.outdir||".";
	session.kdbfn=require("path").resolve(folder, session.config.name+'.kdb');

	setTimeout(indexstep,1);
}

var start=function(mkdbconfig) {
	if (indexing) return null;
	indexing=true;
	if (!mkdbconfig.files || !mkdbconfig.files.length) return null;//nothing to index

	initIndexer(mkdbconfig);
  return status;
}

var indexstep=function() {
	if (session.filenow<session.files.length) {
		status.filename=session.files[session.filenow];
		status.progress=session.filenow/session.files.length;
		status.filenow=session.filenow;
		putFile(status.filename,function(){
			session.filenow++;
			setTimeout(indexstep,1); //rest for 1 ms to response status			
		});
	} else {
		finalize(function(byteswritten) {
			status.done=true;
			indexing=false;
			console.log("bytes written:",byteswritten)
			if (session.config.finalized) {
				session.config.finalized(session,status);
			}
		});	
	}
}

var getstatus=function() {
  return status;
}
var stop=function() {
  status.done=true;
  status.message="User Abort";
  indexing=false;
  return status;
}
var backupFilename=function(ydbfn) {
	//user has a chance to recover from previous ydb
	return ydbfn+"k"; //todo add date in the middle
}

var backup=function(ydbfn) {
	var fs=require("fs");
	var fs=require('fs');
	if (fs.existsSync(ydbfn)) {
		var bkfn=ydbfn+'k';
		try {
			if (fs.existsSync(bkfn)) fs.unlinkSync(bkfn);
			fs.renameSync(ydbfn,bkfn);
		} catch (e) {
			console.log(e);
		}
	}
}
var createMeta=function() {
	var meta={};
	if (session.config.meta) for (var i in session.config.meta) {
		meta[i]=session.config.meta[i];
	}
	meta.name=session.config.name;
	meta.vsize=session.vpos;
	meta.segcount=status.segCount;
	meta.version="2015.1.5";
	meta.builddate=(new Date()).toString();
	return meta;
}
var guessSize=function() {
	var size=session.vpos * 5;
	if (size<1024*1024) size=1024*1024;
	return  size;
}
var buildpostingsLength=function(tokens,postings) {
	var out=[];
	for (var i=0;i<tokens.length;i++) {
		out[i]=postings[i].length;
	}
	return out;
}
var optimize4kdb=function(json) {
	var keys=[];
	for (var key in json.tokens) {
		keys[keys.length]=[key,json.tokens[key]];
	}
	keys.sort(function(a,b){return a[1]-b[1]});//sort by token id
	var newtokens=keys.map(function(k){return k[0]});
	json.tokens=newtokens;
	for (var i=0;i<json.postings.length;i++) json.postings[i].sorted=true; //use delta format to save space
	json.postingslength=buildpostingsLength(json.tokens,json.postings);
	json.fileoffsets.sorted=true;
	json.segoffsets.sorted=true;

	return json;
}

var finalize=function(cb) {	
	//var Kde=nodeRequire("./kde");

	//if (session.kdb) Kde.closeLocal(session.kdbfn);

	session.json.fileoffsets.push(session.vpos); //serve as terminator
	session.json.segoffsets.push(session.vpos); //serve as terminator
	session.json.meta=createMeta();
	
	if (!session.config.nobackup) backup(session.kdbfn);
	status.message='writing '+session.kdbfn;
	//output=api("optimize")(session.json,session.ydbmeta.config);
	var opts={size:session.config.estimatesize};

	if (!opts.size) opts.size=guessSize();
	var kdbw =requireLocal("ksana-indexer").kdbw(session.kdbfn,opts);
	//console.log(JSON.stringify(session.json,""," "));
	if (session.config.finalizeField) {
		console.log("finalizing fields");
		session.config.finalizeField(session.json.fields);
	}
	console.log("optimizing data structure");
	var json=optimize4kdb(session.json);

	if (session.config.extra) {
		json.extra=session.config.extra;
	}
	console.log("number of files:",session.json.filenames.length);
	console.log("number of segments:",session.json.segnames.length);
	console.log("average token per segment:",Math.floor(session.json.meta.vsize/session.json.segnames.length));
	console.log("Writing file:",session.kdbfn);
	kdbw.save(json,null,{autodelete:true});
	
	kdbw.writeFile(session.kdbfn,function(total,written) {
		status.progress=written/total;
		status.outputfn=session.kdbfn;
		if (total==written) {
			cb(total);
		}
	});
}
module.exports={start:start,stop:stop,status:getstatus};