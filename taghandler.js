var on_pb=function(text,tag,attributes,status){
	return [{path:["pb"],value:attributes.n || attributes.id},
		      {path:["pb_vpos"],value:status.vpos}
		    ]
}

var finalize_pb=function(fields){
	console.log("finalizing pb")
	var out=[];
	for (var i=0;i<fields.pb.length;i++) {
		out.push([i,fields.pb[i],fields.pb_vpos[i]]);
	}

	out.sort(function(a,b){
		return (a[1]>b[1])?1:(a[1]<b[1])?-1:0;
	});

	fields.pb_sorted=[];
	fields.pb_sorted_idx=[];
	for (var i=0;i<out.length;i++) {
		fields.pb_sorted_idx.push(out[i][0]);
		fields.pb_sorted.push(out[i][1]);
	}		

}
var on_title=function(text,tag,attributes,status){
	return [{path:["title"],value:text},
			{path:["title_vpos"],value:status.vposstart}
		   ]
}
var on_head=function(text,tag,attributes,status){
	return [{path:["head"],value:attributes.t},
			{path:["head_vpos"],value:status.vposstart}
		    ]
}

var finalize_head=function(fields) {

}

var on_hn=function(text,tag,attributes,status){
	var depth=parseInt(tag.substr(2));
	if (depth-hn_depth>1) {
		console.log("file:"+status.filename+",tag:"+tag+",text:"+text);
		throw "toc depth error"
	}
	hn_depth=depth;
	var tagname=tag.substr(1);
	return [{path:["hn"],value:text}
		      ,{path:["hn_vpos"],value:status.vposstart}
		      ,{path:["hn_depth"],value:depth}
		    ]
}

var finalize_hn=function(fields) { 

}

var init=function() {
	hn_depth=0;
	head_depth=0;
}
module.exports={init:init,on_pb:on_pb,finalize_pb:finalize_pb,
on_title:on_title,	on_head:on_head,on_hn:on_hn,finalize_head:finalize_head,finalize_hn:finalize_hn};


