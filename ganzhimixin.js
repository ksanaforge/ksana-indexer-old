/*
	create unique id for kepan in Chinese Ganzhi style(干支)

*/
var pcountinkepan=0;
var kepanStack=[];

/* generate kepan id, similar to react id */
var getKepanId=function() {
	var out="";
	for (var i=0;i<kepanStack.length;i++) {
		out+="."+kepanStack[i];
	}
	return out.substr(1);//remove leading .
}
/* overwrite pagename */
var getSegName=function(status) {
	var pn=getKepanId();
	if (pcountinkepan||!pn) pn+="@"+pcountinkepan;
	pcountinkepan++;
	return pn;
}
/*
  create Kepan stack.
*/
var onKepan=function(text,tag,attributes,status) {

	var level=ganzhi.indexOf(tag);
	if (level==-1) {
		console.log("not a kepan",tag);
		return;
	}

	pcountinkepan=0;//reset count
	if (level && !kepanStack[level-1]) {
		console.log("kepan level error",attributes.t);
	}
	if (!kepanStack[level]) kepanStack[level]=0;
	kepanStack[level]++;
	kepanStack.length=level+1;
}

var ganzhi="甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥";
var mixin={
	captureTags:{
		"甲": onKepan,"乙": onKepan,"丙": onKepan,"丁": onKepan,"戊": onKepan
		,"己": onKepan,"庚": onKepan,"辛": onKepan,"壬": onKepan,"癸": onKepan
		,"子": onKepan,"丑": onKepan,"寅": onKepan,"卯": onKepan,"辰": onKepan,"巳": onKepan
		,"午": onKepan,"未": onKepan,"申": onKepan,"酉": onKepan,"戌": onKepan,"亥": onKepan
	},
	callbacks:{
		getSegName:getSegName
	}
	,segsep:"@seg"  //special prefix for  segment autonaming
}
module.exports=mixin;