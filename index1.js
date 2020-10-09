const dgram = require('dgram');
const client  = dgram.createSocket('udp4'); 

client.on('close',function(){
    console.log('close')
})
client.on('error', function (error) {
    console.log('error',error)
})

/**
 * rinfo : 远程地址信息 --> 符合udp规范，由dgram解析
 * msg : 消息 --> 符合dns规范，需要参考dns报文进行解析
 */
client.on('message', function (msg,rinfo) {
    console.log('rinfo',rinfo);
    console.log('msg',msg+'');
})


let hex = '28d127172e387ca7b0b2bbb808004500003774f6000080110627c0a81f47c0a81f01f347003500230b7e00020100000100000000000005626169647503636f6d0000010001'
// dgram会自动发送部分信息,需要将报文中自动发送部分截取掉
hex =hex.slice(42*2)
const SendBuff =  Buffer.alloc(hex.length/2, hex, 'hex');

// 192.168.31.1 我的本地路由
// 198.41.0.4  根cdn地址
// 192.43.172.30
client.send(SendBuff,  53, '192.43.172.30',(err)=>{
    console.log('err',err)
}); 
