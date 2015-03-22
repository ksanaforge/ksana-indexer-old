var onKw=function(text,tag,attributes,status) {
	var out=[];
	var n=attributes.n;
	var a=attributes.author || attributes.a;
	if (!n) {
		throw "missing n in <kw"
	}
	var fieldname=tag;
	if (a) fieldname+='_'+a;

	return [
	{path:[fieldname,'n'], value:n}
	,{path:[fieldname,'vpos'], value:status.vpos}
	];
}

var mixin={
	captureTags:{
		kw :onKw
		,kw2 :onKw
		,kw3 :onKw
		,kw4 :onKw
	}
	,segsep:"@seg"
}
module.exports=mixin;
