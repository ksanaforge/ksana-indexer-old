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

module.exports={on_pb:on_pb,finalize_pb:finalize_pb};