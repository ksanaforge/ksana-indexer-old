var build=require("./buildfromxml");
var tei=require("./tei");
var xml4kdb=require("./xml4kdb");
var kdbw=require("./kdbw");
var rawtags=require("./rawtags");
var mkdbconfig=require("./mkdbconfig");
var mixins={"ganzhi":require("./ganzhimixin"),"docx":require("./docxmixin")
,"kepan":require("./kepanmixin")};
module.exports={build:build,tei:tei,xml4kdb:xml4kdb,kdbw:kdbw
,mixins:mixins,rawtags:rawtags,mkdbconfig:mkdbconfig};
