var fs=require("fs");
var requireLocal=function(module) {
	var path=require("path");
	if (module[0]!=".") module="../node_modules/"+module+"/index.js";
	var abspath=path.resolve(process.cwd(),module);
	if (!fs.existsSync(abspath)) {
		module="../"+module;
		abspath=path.resolve(process.cwd(),module);
	}
	return require(abspath);
}

var docx2kdb=requireLocal("ksana-parser-docx");
var convertfile=function(docxfn,cb) {
	if (needxml(docxfn)) {
		console.log("converting",docxfn)
		docx2kdb.convertToXML(docxfn,{},cb);	
	} else {
		cb(0);
	}
}
var needxml=function(docxfn) {
	var xmlfn=docxfn.replace(".docx",".xml");
	xmlfn=xmlfn.trim();
	if (!fs.existsSync(xmlfn)) return true;
	var statxml=fs.statSync(xmlfn);
	var statdocx=fs.statSync(docxfn);
	return (Date.parse(statdocx.mtime)>Date.parse(statxml.mtime));
} 
var savexml=function(session) {
	if (!session.filename) return;	
	var xmlfn=session.filename.replace(".docx",".xml");
	
	var h0=xmlfn.replace(".xml","");
	var idx=h0.lastIndexOf("/");
	if (idx>-1) h0=h0.substr(idx+1);
	fs.writeFileSync(xmlfn,"<xml>\n<H0>"+h0+"</H0>\n"+session.output.join("\n")+"</xml>","utf8");
}
var convertfiles=function(list,cb){
	var taskqueue=[];
	for (var i=0;i<list.length;i++) {
		taskqueue.push(
		(function(fn){
				return (
					function(session){
						if (!(typeof session=='object' && session.__empty)) {
							savexml(session);
						}
						convertfile(fn, taskqueue.shift());
					}
				);
			})(list[i])
		);
	}

	//last call to child load
	taskqueue.push(function(session){
		savexml(session);
		cb();
	});

	taskqueue.shift()({__empty:true});
}
module.exports={convertfile:convertfile,convertfiles:convertfiles};