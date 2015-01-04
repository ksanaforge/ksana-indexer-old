var kde=require("ksana-document").kde;

var bigramcount=0;
var bigram={};
var unigram=[];

var addbigram=function(bi) {
	if (!bigram[bi]) {
		bigram[bi]=0;
		bigramcount++;
	}
	bigram[bi]++;
}
var dopage=function(data) {
	var str=data.join(); //cbeta has lf
	var i=0;
	while (i<str.length) {
		var c1=str.charCodeAt(i);
		var c2=str.charCodeAt(i+1);
		if (c1>=0x4e00 && c1<0x9fff) {
			if (!unigram[c1-0x4e00]) unigram[c1-0x4e00]=0;
			unigram[c1-0x4e00]++;
			if (c2>0x4e00 && c2<0x9fff)	addbigram(str[i]+str[i+1]);
		}
		i++;
	}
}
var dopages=function(data) {
	var lastpercent=0;
	for (var i=0;i<data.length;i++) {
		var percent=Math.floor(i*100/data.length);
		if (percent>lastpercent){
			process.stdout.write(percent+"% \033[0G");
			lastpercent=percent;
		}
		dopage(data[i]);
	}
}
var getunigramhit=function(bi) {
	return unigram[bi.charCodeAt(0)-0x4e00]+
	unigram[bi.charCodeAt(1)-0x4e00]
}
var report=function(bigramarr) {
	var tokencount=unigram.reduce(function(p,i){return p+i},0);
	console.log("token count", tokencount);
	var bigramcount=bigramarr.reduce(function(p,i){return p+i[1]},0);
	console.log("bigram count", bigramcount);
	console.log("overhead",bigramcount/tokencount);
}
var summary=function(opts){
	console.log("bigramcount",bigramcount);

	var bigramarr=[];
	for (var i in bigram) {
		var hit=getunigramhit(i);
		var r=bigram[i]/hit;
		bigramarr.push([i,bigram[i], 
		 unigram[i.charCodeAt(0)-0x4e00],
	     unigram[i.charCodeAt(1)-0x4e00],r]);
	}

	console.log("sorting")
	bigramarr.sort(function(a,b){return b[1]-a[1]});

	bigramarr=bigramarr.filter(function(b){return b[1]>opts.min});

	console.log("writing")
	require("fs").writeFileSync("bigram.txt",bigramarr.join("\n"),"utf8");	

	bigramarr=bigramarr.filter(function(b){return b[4]<opts.maxrate});
	report(bigramarr);
	bigramarr=bigramarr.map(function(b){return b[0]});
	bigramarr.sort(function(a,b){return a>b?1:b>a?-1:0});

	require("fs").writeFileSync("bigram.json",JSON.stringify(bigramarr),"utf8");	


}
var dump=function(db) {
	db.get(["fileContents"],{recursive:true},function(data){
		console.log("loaded");
		console.time("bigram");
		dopages(data);
		console.timeEnd("bigram")
		console.time("summary");
		summary({min:3000,maxrate:0.5});
		console.timeEnd("summary");

	});
}
kde.open("cbeta",dump);
