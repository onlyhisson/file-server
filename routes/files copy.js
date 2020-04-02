const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const fs = require('fs');

const FILE_FORDER = '/home/finl_dump';

let FILE_INFO_LIST = [];

setInterval(function() {
    setFileInfo();
}, 3000);

/************************************************************* 
 * prefix : /files
**************************************************************/

/* 파일 리스트 GET */
router.get('/list', function (req, res) {
    let obj = {
        status: 0,
        fileLength: FILE_INFO_LIST.length,
        fileInfo: FILE_INFO_LIST
    }
    res.jsonp(JSON.stringify(obj));
    //res.jsonp(req.query.callback + '('+ JSON.stringify(obj) + ');');
    //res.send(obj);
});

/* 파일 다운로드 */
router.get('/download/:filename', function (req, res) {
    const fileName = req.params.filename;
    res.download(`${FILE_FORDER}/${fileName}`);
});

/* 가공된 파일 정보 리스트 저장 */
async function setFileInfo() {
    let fileTempInfo = [];
    let fileList = await getFileList();
    fileList.forEach(async(el, idx) => {
        let fileInfo = await getFileInfo(el);
        let hash = await fileHash(el, 'md5');
        let jsonObj = {
            fileName: el,
            size: fileInfo.size,
            md5: hash,
            date: fileInfo.birthtimeMs
        };
        fileTempInfo.unshift(jsonObj)
        if(fileList.length == idx+1) {
            //fileTempInfo.sort(function(a, b) {
            //    return a.size > b.size ? -1 : a.size < b.size ? 1 : 0;
            //});
            FILE_INFO_LIST = fileTempInfo;
        }
    })
};

/* 파일 폴더 */
function getFileList() {
    return new Promise((resolve, reject) => {
        fs.readdir(FILE_FORDER, function (error, fileList) {
            if(error) {
                reject(error);
            } else {
                resolve(fileList);
            }
        });
    });
}

/* 파일 hash 데이터 */
function fileHash(fileName, algorithm) {
    let filename = `${FILE_FORDER}/${fileName}`;
    return new Promise((resolve, reject) => {
        // Algorithm depends on availability of OpenSSL on platform
        // Another algorithms: 'sha1', 'md5', 'sha256', 'sha512' ...
        let shasum = crypto.createHash(algorithm);
        try {
            let s = fs.ReadStream(filename)
            s.on('data', function (data) {
                shasum.update(data)
            })
            // making digest
            s.on('end', function () {
                const hash = shasum.digest('hex')
                return resolve(hash);
            })
        } catch (error) {
            console.log(error);
            return reject('calc fail');
        }
    });
}

/* 파일 정보 */
function getFileInfo(fileName) {
    return new Promise((resolve, reject) => {
        fs.stat(`${FILE_FORDER}/${fileName}`, (err, stats) => {
            if (err) { 
                return reject(err);
            }
            // console.log(stats);          				            // 파일 정보
            // console.log("isFIle : " + stats.isFile());               // 파일 여부
            // console.log("isDirectory : " + stats.isDirectory());     // 디렉토리 여부
            // console.log("isBlockDevice : " + stats.isBlockDevice()); // 블럭타입의 기기 여부
            // console.log("isCharacterDevice : " + stats.isCharacterDevice()); // 문자타입의 기기 여부
            // console.log("isSymbolicLink : " + stats.isSymbolicLink());       // 심볼릭 링크 여부
            // console.log("isFIFO : " + stats.isFIFO());				        // FIFO(유닉스 네임드 파이프) 여부
            // console.log("isSocket : " + stats.isSocket());			        // 도메인 소켓 여부
            return resolve({
                birthtimeMs: formatdateBasic(stats.birthtimeMs),
                size: stats.size
            })
        });
    })
}

function formatdateBasic(timeStamp) {
	let d = new Date(timeStamp);

	yy = d.getFullYear();
	mm = d.getMonth() + 1; mm = (mm < 10) ? '0' + mm : mm;
	dd = d.getDate(); dd = (dd < 10) ? '0' + dd : dd;
	hh = d.getHours(); hh = (hh < 10) ? '0' + hh : hh;
	mi = d.getMinutes(); mi = (mi < 10) ? '0' + mi : mi;
	se = d.getSeconds(); se = (se < 10) ? '0' + se : se;
	
	return '' + yy + '-' +  mm  + '-' + dd + ' ' + hh + ':' + mi + ':' + se;
};

module.exports = router;