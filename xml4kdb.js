
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
var parseSeg=function(segtext) {
	// name,sunit, soff, eunit, eoff , attributes
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
		tags.push([tagoffset , tag,attributes, 0 ]); //vpos to be resolved
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
var parseXML=function(buf, opts){
	opts=opts||{};
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
	var texts=[], tags=[];
	segs.map(function(U,i){
		var out=parseSeg(U[1]);
		if (opts.trim) out.inscription=out.inscription.trim();
		texts.push({n:U[0]||emptypagename,t:out.inscription});
		tags.push(out.tags);
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