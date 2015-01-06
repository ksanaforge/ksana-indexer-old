var pcountinkepan=0;
var kepanStack=[];

/* generate kepan id, similar to react id */
var getKepanId=function() {
	var out="";
	for (var i=0;i<kepanStack.length;i++) {
		out+="-"+kepanStack[i];
	}
	return out.substr(1);//remove leading .
}
/* overwrite pagename */
var getPageName=function(status) {
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