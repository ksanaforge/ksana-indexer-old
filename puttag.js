/*
	maintain a tag stack for known tag
*/
var session,status
var tagStack=[],sepTagname="";
var tagname,nulltag,handler,tagvpos;


var pat=/([a-zA-Z:]+)="([^"]+?)"/g;
var parseAttributesString=function(s) {
	if (!s) return "";
	var out={};
	//work-around for repeated attribute,
	//take the first one
	s.replace(pat,function(m,m1,m2){if (!out[m1]) out[m1]=m2});
	return out;
}
var storeFields=function(fields,json) {
	if (!json.fields) json.fields={};
	var root=json.fields;
	if (!(fields instanceof Array) ) fields=[fields];
	var storeField=function(field) {
		var path=field.path;
		storepoint=root;
		if (!(path instanceof Array)) path=[path];
		for (var i=0;i<path.length;i++) {
			if (!storepoint[path[i]]) {
				if (i<path.length-1) storepoint[path[i]]={};
				else storepoint[path[i]]=[];
			}
			storepoint=storepoint[path[i]];
		}
		if (typeof field.value=="undefined") {
			throw "empty field value of ["+path+"] in file "+status.filename;
		}
		storepoint.push(field.value);
	}
	fields.map(storeField);
}


var processTags=function(callbacks,captureTags,tags,texts) {
	var getTextBetween=function(from,to,startoffset,endoffset) {
		if (from==to) return texts[from].t.substring(startoffset,endoffset);
		var first=texts[from].t.substr(startoffset-1);
		var middle="";
		for (var i=from+1;i<to;i++) {
			middle+=texts[i].t;
		}
		var last=texts[to].t.substr(0,endoffset-1);
		return first+middle+last;
	}

	var processEndTag=function(ntext,attr){
		var prev=tagStack[tagStack.length-1];
		var text="";
		if (!nulltag) {
			if (typeof prev=="undefined" || tagname.substr(1)!=prev[0]) {
				console.error("tag unbalance",tagname,prev,status.filename);
				console.error(tagStack);
				throw "tag unbalance";
			} else {
				tagStack.pop();
				text=getTextBetween(prev[3],ntext,prev[1],tagoffset);
				//console.log(text,prev[1],tagoffset)
			}
		}

		if (typeof prev=="undefined") {
			status.vpos=tagvpos;
		} else {
			status.vpos=tagvpos;
			status.vposstart=prev[4];
			if (!attr) attr=prev[2]; //use attribute from open tag
		}
		var fields=handler(text, tagname, attr, status);
		if (fields) storeFields(fields,session.json);

	}
	var attr=null;
	status.tagStack=tagStack;
	for (var i=0;i<tags.length;i++) {
		for (var j=0;j<tags[i].length;j++) {
			var T=tags[i][j],tagoffset=T[0],attributes=T[2];
			tagvpos=T[3];
			tagname=T[1];
			handler=null;
			var lastchar=attributes[attributes.length-1];
			nulltag=false;
			if (typeof lastchar!="undefined") {
				if (lastchar=="/") {
					nulltag=true;
				} else {
					var lastcc=lastchar.charCodeAt(0);
					if (!(lastchar=='"' ||lastchar=='-'|| (lastcc>0x40 && lastcc<0x7b))) {
						console.error("error lastchar of tag ("+lastchar+")");
						console.error("in <"+tagname,attributes+"> of",status.filename)	;
						throw 'last char of should be / " or ascii ';
					}
				}
			}

			if (captureTags[tagname]) {
				attr=parseAttributesString(attributes);
				if (!nulltag) {
					tagStack.push([tagname,tagoffset,attr,i, tagvpos]);
				}
			}
			if (tagname[0]=="/") handler=captureTags[tagname.substr(1)];
			else if (nulltag) handler=captureTags[tagname];
			if(handler) processEndTag(i,attr);

			if (callbacks.getSegName && tagname==sepTagname){
				session.json.segnames[i]=callbacks.getSegName(status);
			}

		}
	}
}
var init=function(api,_session,_status){
	session=_session;
	status=_status;
}
module.exports={processTags:processTags,init:init};