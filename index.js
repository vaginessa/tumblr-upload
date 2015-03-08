//@todo: cancel upload if a new upload is requested (debounce, but better)
//@todo: prevent upload if file is empty. tumblr will fail silently
'use strict';
var fs = require('fs');
var https = require('https');
var path = require('path');
var yaml = require('js-yaml');
var appRoots = [
	process.cwd(),
	path.dirname(require.main.filename),
	require('app-root-path'),
];

/**
 * Set tumblr account to accept future uploads
 * @param {object|array} c  Credentials to use, object or array in this order: tumblrId, anonId, pfe, pfp, pfs, pfu
 */
function Blog (c) {
	var blog = this;
	if (c && c.length === 6) {
		c = {
			tumblrId: c[0],
			anonId:   c[1],
			pfe:      c[2],
			pfp:      c[3],
			pfs:      c[4],
			pfu:      c[5],
		};
	}
	if (!c || !c.tumblrId || !c.anonId || !c.pfe || !c.pfp || !c.pfs || !c.pfu) {
		throw Error('Credentials missing! Use tumblr-upload.yml or specify them when calling upload()');
	}

	blog.pwd = c;
}

/**
 * Upload the specified template using the previously-specified credentials
 * @param  {string}   htmlTemplate  Tumblr template to upload
 * @param  {Function} callback      Function to call after the upload is done or has failed
 * @return {ClientRequest}          Node ClientRequest method, can be .abort()'ed
 */
Blog.prototype.upload = function (htmlTemplate, callback) {
	var pwd = this.pwd;
	var options = {
		host: 'www.tumblr.com',
		port: 443,
		path: '/customize_api/blog/'+pwd.tumblrId,
		method: 'POST',
		headers: {
			'x-requested-with': 'XMLHttpRequest',
			'x-for-issues': 'https://github.com/bfred-it/tumblr-upload',
			'pragma': 'no-cache',
			'content-type': 'application/json',
			'accept': 'application/json, text/j avascript, */*; q=0.01',
			'cache-control': 'no-cache',
			'Cookie': 'logged_in=1; pfp='+pwd.pfp +'; pfs='+pwd.pfs +'; pfe='+pwd.pfe +'; pfu='+pwd.pfu + '; anon_id='+pwd.anonId+';',
			'referer': 'https://www.tumblr.com/customize/'+pwd.tumblrId+'?redirect_to=/blog/'+pwd.tumblrId
		}
	};
	var httpBody = JSON.stringify({
		'custom_theme': htmlTemplate,
		'id': pwd.tumblrId,
		'user_form_key': '9sjkkF4VL67wLECdsxDHsak7Y'
	});

	// do request
	var request = https.request(options, function (res) {
		if (!callback || !callback.call) {
			return;
		}
		var response = '';
		res.on('data', function (chunk) {
		  response += chunk;
		});
		res.on('end', function () {
			if (/Authentication required|permission/i.test(response)) {
				callback('Authentication failed');
			} else  {
				try {
					//verify that it's a valid json response
					JSON.parse(response);

					callback(false);
				} catch (e) {
					callback('Failed parsing of response: ' + response);
				}
			}
		});
	});

	if (callback && callback.call) {
		request.on('error', function(e) {
			callback(e.message);
		});
	}

	request.write(httpBody);
	request.end();
};


/**
 * Upload specified template and use the settings in tumblr-upload.yml file
 * @see  Blog.prototype.upload
 */
function upload (htmlTemplate, callback) {
	var c, paths = [];

	// try to load config file from all the possible paths
	appRoots.some(function (appRoot) {
		try {
			c = fs.readFileSync(appRoot + '/tumblr-upload.yml', 'utf8');
			c = yaml.safeLoad(c);
			return true;
		} catch (e) {
			var file = e.message.match('no such file or directory \'(.+)\'');
			if (file) {
				paths.push(path.dirname(file[1]));
			}
		}
	});

	// cheaply verify credentials
	if (!c || !c.tumblrId || !c.anonId || !c.pfe || !c.pfp || !c.pfs || !c.pfu) {
		throw Error('Credentials missing! Use tumblr-upload.yml or specify them when calling upload(). I looked for that file in:\n'+paths.join('\n'));
	}

	// upload template
	return new Blog(c).upload(htmlTemplate, callback);
}

module.exports = upload;
module.exports.Blog = Blog;