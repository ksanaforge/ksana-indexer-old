var indexing=false; //only allow one indexing task
var status={segCount:0,progress:0,done:false}; //progress ==1 completed
var session={};
//
var requireLocal=function(module) {
	var path=require("path");
	var fs=require("fs");
	if (module[0]!=".") module="../node_modules/"+module+"/index.js";
	var abspath=path.resolve(process.cwd(),module);
	if (!fs.existsSync(abspath)) {
		module="../"+module;
		abspath=path.resolve(process.cwd(),module);
	}
	return require(abspath);
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
		,_tokenids:[] //not in kdb
		,_txtid:{}  //not in kdb
	};
	config.inputEncoding=config.inputEncoding||"utf8";
	var session={vpos:1, json:json , kdb:null, done:false
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
	//console.log(config,mixin);
}
var taghandler=require("./taghandler");

var setupPaging=function(paging) {
	if (!session.config.captureTags) session.config.captureTags={};
	var onhandler=taghandler["on_"+paging];
	if (onhandler && !session.config.captureTags[paging]) {
		session.config.captureTags[paging]=onhandler;
	}
}
var finalizePaging=function(paging,fields){
	var onhandler=taghandler["on_"+paging];
	if (onhandler!=session.config.captureTags[paging]) return;

	var handler=taghandler["finalize_"+paging];
	if (handler) handler(fields);
}
var setupToc=function(toc) {
	if (!session.config.captureTags) session.config.captureTags={};
	var onhandler=taghandler["on_"+toc];
	if (onhandler) {
		if (toc==="hn") { //special case
			for (var i=1;i<10;i++){
				if (!session.config.captureTags["h"+i]) {
					session.config.captureTags["h"+i]=onhandler;
				}
			}
		} else {
			if (!session.config.captureTags[toc]) {
				session.config.captureTags[toc]=onhandler;	
			}
		}
	}
}

var finalizeToc=function(toc,fields){
	var onhandler=taghandler["on_"+toc];
	if (onhandler!=session.config.captureTags[toc]) return;


	var handler=taghandler["finalize_"+toc];
	if (handler) handler(fields);
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
		if (!storepoint) {
			console.log("empty storepoint",path,fields);
			throw "empty storepoint!!";
		}
		if (typeof field.value=="undefined") {
			throw "empty field value of ["+path+"] in file "+status.filename;
		}
		storepoint.push(field.value);
	}
	fields.map(storeField);
}
status.storeFields=storeFields;
var initIndexer=function(mkdbconfig) {
	session=initSession(mkdbconfig);

	mergemixin(mkdbconfig);
	
	var analyzer=requireLocal("ksana-analyzer");
	var api=analyzer.getAPI(mkdbconfig.meta.config);

	var xml4kdb=requireLocal("ksana-indexer").xml4kdb;
	var rawtags=requireLocal("ksana-indexer").rawtags;
	var processTags=require("./puttag").processTags;

	rawtags.init();
	taghandler.init();

	//mkdbconfig has a chance to overwrite API
	if (mkdbconfig.meta && mkdbconfig.meta.normalize) {
		api.setNormalizeTable(mkdbconfig.meta.normalize);
	}

	require("./puttag").init(api,session,status,storeFields);
	require("./putfile").init(api,session,status,xml4kdb,rawtags,processTags,storeFields);

	var folder=session.config.outdir||".";
	session.kdbfn=require("path").resolve(folder, session.config.name+'.kdb');

	if (mkdbconfig.meta.paging) {
		setupPaging(mkdbconfig.meta.paging);
	}
	if (mkdbconfig.meta.toc) {
		setupToc(mkdbconfig.meta.toc);
	}
	setTimeout(indexstep,1);
}


var start=function(mkdbconfig) {
	if (indexing) return null;
	indexing=true;
	initIndexer(mkdbconfig);
  return status;
}


var indexstep=function() {
	var putFile=require("./putfile").putFile;

	session.config.callbacks=session.config.callbacks||{};

	session.config.next(null,function(err,res){
		if (err) {
			throw err;
			return;
		}

		if (res) {
			status.filename=res.filename;
			status.progress=res.progress;
			status.content=res.content;

			putFile(status.filename,status.content,function(){
				setTimeout(indexstep,1); //rest for 1 ms to response status
			});
		} else {
			finalize(function(byteswritten) {
				status.done=true;
				indexing=false;
				console.log("bytes written:",byteswritten)
				if (session.config.callbacks.finalized) {
					session.config.callbacks.finalized(session,status);
				}
			});
		}

	})
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
	meta.version=Date.now().toString();
	meta.builddate=(new Date()).toString();
	meta.indexer=10;
	return meta;
}
var guessSize=function() {
	var size=session.vpos * 10;
	if (size<1024*1024*64) size=1024*1024*64;
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
	console.log('optimizing');

	/*
	var keys=[];
	for (var key in json.tokens) {
		keys[keys.length]=[key,json.tokens[key]];
	}
	*/
	if (!session.config.norawtag) {		
		var rawtags=requireLocal("ksana-indexer").rawtags;
		var raw=rawtags.toJSON();
		if (raw.tag.length && raw.tag[0]) {
			json.rawtag=raw; 
		} else {
			delete json.raw;
			delete json.rawtag;
		}
	}

	json._tokenids.sort(function(a,b){return a[1]-b[1]});//sort by token id
	var newtokens=[];
	for (var i=0;i<json._tokenids.length;i++){
		var tk=json._tokenids[i][0];
		var code=tk.charCodeAt(0);
		if (code>0xd900&&code<0xdc00) continue; //android cannot parse with U+F0000
		newtokens.push(tk);
	}
	//var newtokens=json._tokenids.map(function(k){return k[0]});

	delete json._tokenids;
	delete json._txtid;

	for (var f in json.fields) {
		if (f.substr(f.length-5)==="_vpos") {
			json.fields[f].sorted=true;
		}
	}

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
	if (session.config.callbacks.finalizeField) {
		console.log("finalizing fields");
		session.config.callbacks.finalizeField(session.json.fields);
	}
	if (session.config.callbacks.finalizeJSON) {//low level beware
		console.log("finalizing output JSON");
		session.config.callbacks.finalizeJSON(session.json);
	}
	if (session.config.paging) finalizePaging(session.config.paging,session.json.fields)
	if (session.config.paging) finalizeToc(session.config.toc,session.json.fields)

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

	if (session.config.noWrite) {
		console.log("not writing to disk");
		cb(0);
	} else {
		kdbw.writeFile(session.kdbfn,function(total,written) {
			status.progress=written/total;
			status.outputfn=session.kdbfn;
			if (total==written) {
				cb(total);
			}
		});
	}
}
module.exports={start:start,stop:stop,status:getstatus};