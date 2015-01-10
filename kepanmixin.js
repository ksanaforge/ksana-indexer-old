var onKw=function(text,tag,attributes,status) {
	var out=[];
	var n=attributes.n;
	var a=attributes.author || attributes.a;
	if (!n) {
		throw "missing n in <kw"
	}
	var fieldname="kw";
	if (a) fieldname+='-'+a;

	//console.log(n,status.vpos)
	return [
	{path:[fieldname,'n'], value:n}
	,{path:[fieldname,'vpos'], value:status.vpos}
	];
}

var mixin={
	captureTags:{
		kw :onKw
	}
}
module.exports=mixin;