/*
	save raw tag in kdb efficiently
*/
var tagoffset=[]; //absolute offset from begining of segment of the tag
var tagbody=[];   //tag body
var nsegment=[];  //consists of nsegment with one or more tags
    nsegment.sorted=true;
var tagend=[];    //nsegment's tag ends at
    tagend.sorted=true; //packed int

var init=function() {

}
var finalize=function(){

}
var emit=function(nseg,tags) {
	for (var i=0;i<tags.length;i++) {
		var tag=tags[i]
		tagoffset.push(tag[0]);
		tagbody.push((tag[1]+ " "+tag[2]).trim());
	}
	nsegment.push(nseg);
	tagend.push(tagbody.length);
}

var toJSON=function() {
	return {
		seg:nsegment,
		ends:tagend,
		offset:tagoffset,
		tag:tagbody
	};
}
module.exports={init:init,emit:emit,toJSON:toJSON,finalize:finalize};