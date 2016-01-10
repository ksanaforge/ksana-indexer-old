
var outback = function (s) {
    while (s.length < 70) s += ' ';
    var l = s.length; 
    for (var i = 0; i < l; i++) s += String.fromCharCode(8);
    process.stdout.write(s);
}
var movefile=function(sourcefn,targetfolder) {
	var fs = require("fs");
	var source = fs.createReadStream(sourcefn);
	var path=require("path");
	var targetfn=path.resolve(process.cwd(),"..")+path.sep+path.basename(sourcefn);
	var destination = fs.createWriteStream(targetfn);
	console.log(targetfn);
	source.pipe(destination, { end: false });
	source.on("end", function(){
	    fs.unlinkSync(sourcefn);
	});
	return targetfn;
}
var mkdbjs="mkdb.js";
var starttime=0;
var startindexer=function(mkdbconfig) {
  var indexer=require("./indexer");

  var session=indexer.start(mkdbconfig);
  if (!session) {
      console.log("No file to index");
      return;
  }
  var getstatus=function() {
    var status=indexer.status();

    if (status.done) {
      var endtime=new Date();
      console.log("Completed, elapsed:",(endtime-starttime) /1000,"sec") ;

      //status.outputfn=movefile(status.outputfn,"..");
      clearInterval(timer);
    } else {
      if (mkdbconfig.callbacks && mkdbconfig.callbacks.onStatus) {
        mkdbconfig.callbacks.onStatus(status);  
      }
    }
  }  
  var timer=setInterval( getstatus, 1000);
}

var build=function(mkdbconfig){
  var fs=require("fs");
  starttime=new Date();
  console.log("START",starttime);
  var glob = require("glob");
  var preprocessor=require("./preprocessor");

  if (typeof mkdbconfig.preprocessor==="function") preprocessor=mkdbconfig.preprocessor;
    
  if (typeof mkdbconfig.glob==="string") {
    if (mkdbconfig.glob.indexOf(".lst")===mkdbconfig.glob.length-4) {
      var files=fs.readFileSync(mkdbconfig.glob,"utf8")
      .replace(/\r\n/g,"\n").replace(/\r/g,"\n").split("\n");
      mkdbconfig.next=preprocessor(files.sort(),mkdbconfig);
      startindexer(mkdbconfig);
    } else {
      glob(mkdbconfig.glob, function (err, files) {
        mkdbconfig.next=preprocessor(files.sort(),mkdbconfig);
        startindexer(mkdbconfig);
      });          
    }

  } else {
    mkdbconfig.next=preprocessor(mkdcbconfig.glob);
    startindexer(mkdbconfig);
  }
}

module.exports=build;