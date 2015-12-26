var H=require("./taghandler");

var captureTags={
	"title":H.on_title,
	"pb":H.on_pb,
	"h1":H.on_hn,
	"h2":H.on_hn,
	"h3":H.on_hn,
	"h4":H.on_hn,
	"h5":H.on_hn,
	"h6":H.on_hn,
	"h7":H.on_hn,
	"h8":H.on_hn,
	"h9":H.on_hn
};

module.exports={
	meta:{
		config:"simple1",
		toc:"hn"
	}
	,captureTags:captureTags
	,segsep:"_.id"
}