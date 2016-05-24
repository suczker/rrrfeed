// Converts the feed to XML

var posts = require(process.argv[2]);

console.log('<?xml version="1.0" encoding="UTF-8"?>');
console.log('<posts>');
for(var postIdx in posts){
    var post = posts[postIdx];
    console.log('<post date="' + post.date + '"' 
	        + ' author="' + post.author + '"'
	        + ' uuid="' + post.UUID + '">' + "\n" 
		+ post.text.replace(/&/g, '&#160;').replace(/<br>/g, '')
			
		+ "\n</post>");
}
console.log('</posts>');
