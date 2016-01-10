var glob = require("glob");
var createPreprocessor=function(files,config){
	var fs=require("fs");
	var now=0;

	var next=function(opts,cb) {
		if (now===files.length) {
			cb(0,null);
			return;
		}
		var filename=files[now];

		now++;
		var content=fs.readFileSync(filename,config.inputEncoding).replace(/\r\n/g,"\n");
		if (content.charCodeAt(0)==0xfeff) {//remove BOM
			content=content.substring(1);
		}
		cb(0,{filename:filename,content:content,progress:(now+1)/files.length});
	}

	return next;
}

module.exports=createPreprocessor;