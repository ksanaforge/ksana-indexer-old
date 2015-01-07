var docx2xml=require("./docx2xml");

var do_h0=function(text,tag,attributes,status) {
	var res=[];
	res=res.concat([
		{path:["head_depth"], value:1 }
		,{path:["head"], value:text  }
		,{path:["head_voff"], value: status.vpos }
	]);
	return res;
}
var do_h2=function(text,tag,attributes,status) {
	var res=[];
	var m=text.match(/第(\d+)條/);
	if (!m) return;
	res=res.concat([
		{path:["head_depth"], value:2 }
		,{path:["head"], value:m[1]  }
		,{path:["head_voff"], value: status.vpos }
	]);
	return res;
}

var captureTags={
	"H0":do_h0,
	"H2":do_h2,
}
var onPrepareFile=function(fn,cb) {
	var xmlfn=fn.replace(".docx",".xml");
	docx2xml.convertfile(fn,function(content){
		if (content) {
			var h0=xmlfn.replace(".xml","");
			var idx=h0.lastIndexOf("/");
			if (idx>-1) h0=h0.substr(idx+1);		
			require("fs").writeFileSync(xmlfn,"<xml>\n<H0>"+h0+"</H0>\n"+content.join("\n")+"</xml>","utf8");			
		}
		cb(xmlfn);
	});
}
var config={
	meta:{
		config:"simple1"	
	}
	,callbacks: {
		onPrepareFile: onPrepareFile
	}
	,segsep:"a.n"
	,captureTags:captureTags
}
module.exports=config;