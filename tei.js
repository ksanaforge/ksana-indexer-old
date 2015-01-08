
var anchors=[];
var parser=null,filename="";
var context=null, config={};
var tagmodules=[];

var warning=function(err) {
	if (config.warning) {
		config.warning(err,filename);
	} else {
		console.log(err,filename);	
	}	
}
var ontext=function(e) {
	//if (context.handler) 
	context.text+=e;
}
var onopentag=function(e) {
	if (context.parents.length) {
		context.paths.push(e.name);
	}
	context.parents.push(e);
	context.now=e;	
	context.path=context.paths.join("/");
	if (!context.handler) {
		var handler=context.handlers[context.path];
		if (handler) {
			context.handler=handler;
			context.rootpath=context.path;
		}
		var close_handler=context.close_handlers[context.path];
		if (close_handler) 	context.close_handler=close_handler;
	}

	if (context.handler) {
		var root=context.path==context.rootpath;
		context.handler(root);
	} 
}

var onclosetag=function(e) {
	context.now=context.parents[context.parents.length-1];
	var handler=context.close_handlers[context.path];
	if (handler) {
		var res=null;
		var root=context.path==context.rootpath;
		if (context.close_handler) res=context.close_handler(root);
		context.handler=null;//stop handling
		context.rootpath=null;
		context.close_handler=null;//stop handling
		context.text="";
		if (res && context.status.storeFields) {
			context.status.storeFields(res, context.status.json);
		}
	} else if (context.close_handler) {
		var root=context.path==context.rootpath;
		context.close_handler(root);
	}
	
	context.paths.pop();
	context.parents.pop();
	context.path=context.paths.join("/");		
}
var addHandler=function(path,_tagmodule) {
	var tagmodule=_tagmodule;
	if (typeof tagmodule=="function") {
		tagmodule={close_handler:_tagmodule};
	}
	if (tagmodule.handler) context.handlers[path]=tagmodule.handler;
	if (tagmodule.close_handler) context.close_handlers[path]=tagmodule.close_handler;
	if (tagmodule.reset) tagmodule.reset();
	tagmodule.warning=warning;
	tagmodules.push(tagmodule);
}
var closeAnchor=function(pg,T,anchors,id,texts) {
	var beg="beg"+id.substr(3);
	for (var j=anchors.length-1;j>=0;j--) {
		if (anchors[j][3]!=beg) continue;
		var anchor=anchors[j];
		
		if (pg==anchor[0]) { //same page
			anchor[2]=T[0]-anchor[1]; // length
		} else { //assume end anchor in just next page// ref. pT01p0003b2901
			var pagelen=texts[anchor[0]].t.length;
			anchors[j][2]= (pagelen-anchor[1])  + T[0];
		}
		return;
	}
	warning("cannot find beg pointer for anchor:"+id);
}
// [pg, start, len, id]
var createAnchors=function(parsed) {
	var anchors=[];
	var tags=parsed.tags;
	for (var pg=0;pg<tags.length;pg++){
		var pgtags=tags[pg];
		for (var i=0;i<pgtags.length;i++) {
				var T=pgtags[i];
				if (T[1].indexOf("anchor xml:id=")!=0) continue;
				var id=T[1].substr(15);
				id=id.substr(0,id.indexOf('"'));
				if (id.substr(0,3)=="end") {
					closeAnchor(pg,T,anchors,id,parsed.texts);
				} else {
					anchors.push([pg,T[0],0,id]);	
				}
			}
	}
	return anchors;	
}
var resolveAnchors=function(anchors,texts) {
	tagmodules.map(function(m){
		if (m.resolve) m.resolve(anchors,texts);
	})
}
var  createMarkups=function(parsed) {
	anchors=createAnchors(parsed);
	resolveAnchors(anchors,parsed.text);

	for (var i=0;i<anchors.length;i++) {
		if (anchors[i][4] && !anchors[i][4].length) {
			config.warning("unresolve anchor"+anchors[i][3]);
		}
	}
	return anchors;
}
var handlersResult=function() {
	var out={};
	tagmodules.map(function(m){
		if (m.result) out[m.name]=m.result();
	})
}
var requireLocal=function(module) {
	if (module[0]!=".") module="../node_modules/"+module+"/lib/sax.js";
	return require(require("path").resolve(process.cwd(),module));
}

var parseP5=function(xml,parsed,fn,_config,_status) {
	parser=requireLocal("sax").parser(true);
	filename=fn;
	context={ paths:[] , parents:[], handlers:{}, close_handlers:{}, text:"" ,now:null,status:_status};
	parser.onopentag=onopentag;
	parser.onclosetag=onclosetag;
	parser.ontext=ontext;
	config=_config;
	tagmodules=[];
	context.addHandler=addHandler;
	if (_config.setupHandlers) config.setupHandlers.apply(context);
	if (config.callbacks && config.callbacks.beforeParseTag) {
		xml=config.callbacks.beforeParseTag(xml);
	}
	parser.write(xml);
	context=null;
	parser=null;
	if (parsed) return createMarkups(parsed);
	else return handlersResult();
}
module.exports=parseP5;