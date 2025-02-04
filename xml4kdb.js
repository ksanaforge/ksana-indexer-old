
var tags=[];
var tagstack=[];
var parseXMLTag=function(s) {
	var name="",i=0;
	if (s[0]=='/') {
		return {name:s.substring(1),type:'end'};
	}
	while (s[i] && (s.charCodeAt(i)>0x30)) {name+=s[i];i++;}
	var type="start";
	if (s[s.length-1]=='/') { type="emtpy"; }
	var attr={},count=0;
	s=s.substring(name.length+1);
	s.replace(/(.*?)="([^"]*?)"/g,function(m,m1,m2) {
		attr[m1]=m2;
		count++;
	});
	if (!count) attr=undefined;
	return {name:name,type:type,attr:attr};
};
var removeInvalidChar=function(text) {//android will crash
	return text.replace(/[\uD900-\uDBFF][\uDC00-\uDFFF]/g,"??");
}
var parseSeg=function(segtext) {
	// name,sunit, soff, eunit, eoff , attributes
	segtext=removeInvalidChar(segtext);
	var totaltaglength=0,tags=[],tagoffset=0;
	var parsed=segtext.replace(/<(.*?)>/g,function(m,m1,off){
		var i=m1.indexOf(" "),tag=m1,attributes="";
		if (i>-1) {
			tag=m1.substr(0,i);
			attributes=m1.substr(i+1);
		}else{ //handle <p/>
			i=m1.indexOf("/");
			if (i>0) {
				tag=m1.substr(0,i);
				attributes="/";
			}
		}
		tagoffset=off-totaltaglength;
		if (tag) {
			tags.push([tagoffset , tag,attributes, 0 ]); //vpos to be resolved	
		} else {
			console.log("warning empty tag ",segtext);
		}
		totaltaglength+=m.length;
		return ""; //remove the tag from inscription
	});
	return {inscription:parsed, tags:tags};
};
var splitSeg=function(buf,segsep,maxsegsize) {
	var segs=[], seg="", last=0 ,name="",segcount=0;
	buf.replace(segsep,function(m,m1,offset,b){
		if (typeof b=="undefined") { //autonaming
			offset=m1;
			m1=(++segcount).toString();
		}
		if (offset-last>maxsegsize) {
			throw "seg '"+name+"' too big "+buf.substring(0,100)+"...";
		}
		segs.push([name,buf.substring(last,offset),last]);
		name=m1;
		last=offset;//+m.length;   //keep the separator
	});
	segs.push([name,buf.substring(last),last]);
	return segs;
};
var defaultsep="_.id";
var emptypagename="_";

var createSegsFromCSV=function(buf) {
	var segs=[];
	var lines=buf.trim().replace(/\r\n/g,"\n").split("\n");
	for (var i=0;i<lines.length;i++) {
		var L=lines[i].trim();
		if (!L) {
			console.log("empty line",i);
			continue;
		}
		L=L.replace(/\\n/g,"\n");
		L=L.replace(/\\t/g,"\t");
		var comma=L.indexOf(",");
		if (comma==-1) {
			console.log("ignore line without comma",i);
		} else{
			segs.push([L.substr(0,comma),L.substr(comma+1)]);			
		}
	}
	return segs;
}
var createSegsFromTSV=function(buf) {
	var segs=[];
	var lines=buf.trim().replace(/\r\n/g,"\n").split("\n");
	for (var i=0;i<lines.length;i++) {
		var L=lines[i].trim();
		
		if (!L) {
			console.log("empty line",i);
			continue;
		}
		L=L.replace(/\\n/g,"\n");
		var tab=L.indexOf("\t");
		if (tab==-1) {
			console.log("ignore line without tab",i);
		} else {
			segs.push([L.substr(0,tab),L.substr(tab+1)]);	
		}
	}
	return segs;
}
var createSegsFromTag=function(buf,opts) {
	var sep=opts.segsep||defaultsep, sepTagname=sep;
	opts.maxsegsize=opts.maxsegsize||65536;
	if (sep[0]=="@") {
		sepTagname=sep.substr(1);
		var segsep=new RegExp("<"+sepTagname+"/>","g"); //no m1
		//use tagname as pagename first, resolve in processTag phrase
	} else{
		var dotpos=sep.indexOf(".");
		if (dotpos==-1) {
			var segsep=new RegExp('<'+sep+'>([^<]*?)</'+sep+'>' , 'g')  ;
		}  else {
			sepTagname=sep.substr(0,dotpos);
			var segsep=new RegExp('<'+sep.replace(".",".*? ")+'="([^"]*?)"' , 'g')  ;
		}
	}
	var segs=splitSeg(buf, segsep, opts.maxsegsize);
	return segs;
}
var parseXML=function(buf, opts){
	opts=opts||{};
	var sep=opts.segsep||defaultsep, sepTagname=sep;
	var texts=[], tags=[];
	var segs=null;

	if (opts.csv) {
		segs=createSegsFromCSV(buf);
	} else if (opts.tsv) {
		segs=createSegsFromTSV(buf);
	} else {
		segs=createSegsFromTag(buf,opts);
	}

	segs.forEach(function(U,i){
		var out=parseSeg(U[1]);
		if (out.inscription) {
			var segname=U[0]||emptypagename;
			if(opts.callbacks&&opts.callbacks.onSegName) {
				var r=opts.callbacks.onSegName(segname);
				if (r && typeof r==="string") segname=r;
			}
			texts.push({n:segname,t:out.inscription});
			tags.push(out.tags);
		}
	});
	return {texts:texts,tags:tags,sep:sep,sepTagname:sepTagname};
};

/*
    doc.tags hold raw xml tags, offset will be adjusted by evolvePage.
    should not add or delete page, otherwise the export XML is not valid.
*/
/*
		var o=pg.getOrigin();
		if (o.id && this.tags[o.id-1] && this.tags[o.id-1].length) {
			this.tags[o.id-1]=pg.upgradeXMLTags(this.tags[o.id-1], pg.__revisions__());
		}
*/
var upgradeXMLTags=function(tags,revs) {
	var migratedtags=[],i=0, delta=0;
	for (var j=0;j<tags.length;j++) {
		var t=tags[j];
		var s=t[0], l=t[1].length, deleted=false;
		while (i<revs.length && revs[i].start<=s) {
			var rev=revs[i];
			if (rev.start<=s && rev.start+rev.len>=s+l) {
				deleted=true;
			}
			delta+= (rev.payload.text.length-rev.len);
			i++;
		}
		var m2=[t[0]+delta,t[1]];
		migratedtags.push(m2);
	};
	return migratedtags;
}

var migrateRawTags=function(doc,tags) {
	var out=[];
	for (var i=0;i<tags.length;i++) {
		var T=tags[i];

		var pg=doc.getPage(i+1);
		var offsprings=pg.offsprings();
		for (var j=0;j<offsprings.length;j++) {
			var o=offsprings[j];
			var rev=pg.revertRevision(o.revert,pg.inscription);
			T=upgradeXMLTags(T,rev);
			pg=o;
		}
		out.push(T);
	}
	return out;
}
var exportXML=function(doc,originalrawtags){
	var out=[],tags=null;
	rawtags=migrateRawTags(doc,originalrawtags);
	doc.map(function(pg,i){
		var tags=rawtags[i];  //get the xml tags
		var tagnow=0,text="";
		var t=pg.inscription;
		for (var j=0;j<t.length;j++) {
			if (tagnow<tags.length) {
				if (tags[tagnow][0]==j) {
					text+="<"+tags[tagnow][1]+">";
					tagnow++;
				}
			}
			text+=t[j];
		}
		if (tagnow<tags.length && j==tags[tagnow][0]) text+="<"+tags[tagnow][1]+">";
		out.push(text);
	})

	return out.join("");
};


module.exports={parseXML:parseXML, exportXML:exportXML}
