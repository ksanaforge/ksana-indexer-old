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
		,tokenids:[] //not in kdb
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
	//console.log(config,mixin);
}
var taghandler=require("./taghandler");

var setupPaging=function(paging) {
	if (!session.config.captureTags) session.config.captureTags={};
	var handler=taghandler["on_"+paging];
	if (handler) session.config.captureTags[paging]=handler;
}
var finalizePaging=function(paging,fields){
	var handler=taghandler["finalize_"+paging];
	if (handler) handler(fields);
}
var setupToc=function(toc) {
	if (!session.config.captureTags) session.config.captureTags={};
	var handler=taghandler["on_"+toc];
	if (handler) {
		if (toc==="hn") { //special case
			for (var i=1;i<10;i++){
				session.config.captureTags["h"+i]=handler;		
			}
		} else {
			session.config.captureTags[toc]=handler;	
		}
	}
}
var finalizeToc=function(toc,fields){
	var handler=taghandler["finalize_"+toc];
	if (handler) handler(fields);
}

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

	require("./puttag").init(api,session,status);
	require("./putfile").init(api,session,status,xml4kdb,rawtags,processTags);

	var folder=session.config.outdir||".";
	session.kdbfn=require("path").resolve(folder, session.config.name+'.kdb');

	if (mkdbconfig.paging) {
		setupPaging(mkdbconfig.paging);
	}
	if (mkdbconfig.toc) {
		setupToc(mkdbconfig.toc);
	}
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
	var putFile=require("./putfile").putFile;

	session.config.callbacks=session.config.callbacks||{};
	if (session.filenow<session.files.length) {
		status.filename=session.files[session.filenow];
		status.progress=session.filenow/session.files.length;
		status.filenow=session.filenow;
		if (session.config.callbacks.onPrepareFile){
			session.config.callbacks.onPrepareFile(status.filename,function(fn){
				status.filename=fn;
				putFile(status.filename,function(){
					session.filenow++;
					setTimeout(indexstep,1); //rest for 1 ms to response status
				});
			});
		}else {
			putFile(status.filename,function(){
				session.filenow++;
				setTimeout(indexstep,1); //rest for 1 ms to response status
			});
		}

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
	/*
	var keys=[];
	for (var key in json.tokens) {
		keys[keys.length]=[key,json.tokens[key]];
	}
	*/
	if (!session.config.norawtag) {		
		var rawtags=requireLocal("ksana-indexer").rawtags;
		var raw=rawtags.toJSON();
		if (raw.tag.length) json.rawtag=raw;
	}

	json.tokenids.sort(function(a,b){return a[1]-b[1]});//sort by token id
	var newtokens=json.tokenids.map(function(k){return k[0]});
	delete json.tokenids;

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

	kdbw.writeFile(session.kdbfn,function(total,written) {
		status.progress=written/total;
		status.outputfn=session.kdbfn;
		if (total==written) {
			cb(total);
		}
	});
}
module.exports={start:start,stop:stop,status:getstatus};