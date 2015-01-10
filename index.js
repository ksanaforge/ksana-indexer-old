var build=require("./buildfromxml");
var tei=require("./tei");
var xml4kdb=require("./xml4kdb");
var kdbw=require("./kdbw");
var mixins={"ganzhi":require("./ganzhimixin"),"docx":require("./docxmixin")
,"kepan":require("./kepanmixin")};
module.exports={build:build,tei:tei,xml4kdb:xml4kdb,kdbw:kdbw
	,mixins:mixins};