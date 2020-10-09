# dns介绍
DNS是应用层协议 【类似http】

主要用于将域名转换为ip 【业务功能】

本身使用udp

## 转换流程 [简易]
1. 获取dns服务器【本地DNS服务器】

DNS地址可手动设置,如图
![DNS服务器](/static/1.png)

2. 发送请求报文
可使用如下命令`nslookup baidu.com`,或直接使用浏览器

报文内容可使用wireshark进行查看,如图

![请求报文](/static/2.png)

3. 获取请求信息

可使用wireshark进行查看,如图

![相应报文](/static/3.png)


### 通过udp[dgram]发送请求报文,模拟请求流程
dgram api
http://nodejs.cn/api/dgram.html#dgram_event_message


1. 使用wireshark 截取报文

获取报文如下`28d127172e387ca7b0b2bbb808004500003774f6000080110627c0a81f47c0a81f01f347003500230b7e00020100000100000000000005626169647503636f6d0000010001` 【复制hex stream】

2. 获取端口号

传输层【udp/tcp】 需要端口号

可在请求报文中查到,为53
![端口号](/static/4.png)


3. 发送报文

注1:发送空内容,可发现node的`dgram`会自动发送42个字节【336位】,具体内容可参考udp的请求报文,配合wireshark进行理解

注2:字段`protocol`,发送空内容时显示udp,使用命令或脚本时显示dns,即dns为基于udp 的一种报文 【请求头依然需要符合udp协议】

![默认报文](/static/5.png)

4. 可看到获取的内容与使用命令获取的内容一致

![返回报文](/static/6.png)

参考`index1.js`,代码如下
```javascript
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
client.send(SendBuff,  53, '192.168.31.1',(err)=>{
    console.log('err',err)
}); 
```


### 了解建议流程可推测出如下内容

1. dns内容/协议：对udp-data部分进行一定约束

注1：具体内容不做解释,因为格式固定,使用相应的工具会自行进行解析,了解即可

注2：自定义协议,通常会使用固定的字节的方式,在优化传输长度,尤其是固定内容如数字时,非常有效  -- 实时数据websocket数据优化【占坑】

注3：事务 ID是比较重要的属性,严格来说只要设计顺序,都会由此设计 -- 前端单例--解决请求顺序问题【占坑】

2. 默认端口号53

3. dns劫持

dns服务器不靠谱,如黑掉路由【尤其是家用路由】,修改DNS为自己的DNS服务器即可

4. 为什么有些域名只有内网可以访问

内网dns

### 也会产生如下疑问
DNS服务器[如192.168.31.1],哪来的数据

核心在于dns服务器不是单机服务属于标准的`分布式`集群

注1:此处分布式非常符合单一 + 处处缓存的原则,所以实际上的根/次级域名,不会存在太多正常的流量

注2:因为处处缓存,所以像微信,qq正常,但无法上网的情况,多半跟DNS有关

### DNS集群-- 域名层次
设计上类似于负载均衡,根据域名的层次就够进行负载划分,当然这里的负载完全由业务方处理,不存在一种全局的设置,只存在全局的约定

域名结构：`主机名.次级域名.顶级域名.根域名`

根域名：统一为.root 默认不写root/.root

顶级域名: .com/.org 也可以称为国家级域名

注1：拥有顶级域名，理论上拥有顶级域名下所有的二级域名【次级域名】，拥有者不是ICANN，就是国家【如.cn由工信部管理】或者巨头公司【如阿里的.taobao】

注2：顶级域名查询 -- http://www.iana.org/domains/root/db


次级域名：我们能在顶级域名下注册的域名【如baidu.com】

主机名：买下域名后,设置的前缀以区分服务器,可自由设置 【如fanyi.baidu.com】

### DNS集群-- 递归查询
如果主机所询问的本地域名服务器不知道被查询的域名的IP地址，那么本地域名服务器就以DNS客户的身份，向其它根域名服务器继续发出查询请求报文(即替主机继续查询)

本地域名服务器,也叫`递归域名服务器`

其他根/顶级/次级服务器,也叫`权威服务器`

### DNS集群-- 迭代查询
域名服务器返回下一个需要请求的地址[迭代版本。。]或具体的ip

即实现"负载逻辑"

### DNS集群 -- 迭代查询流程

1. 获取根域名服务器

根域名服务器固定13个,通常地址固定

2. 根据根域名服务器,获取顶级域名服务器
3. 根据顶级域名服务器,获取次级域名服务器
4. 根据次级域名服务器,获取主机名与ip

根据"负载均衡"的处理最终在`次级域名服务器`获取到最终的业务数据

### DNS集群 -- 实验
使用`dig +trace baidu.com` 进行流程查看

注：A,NS均为DNS的类型,其中

A指address，最终的ip地址，NS指Name Server，下一个服务器地址

1. 获取根服务器

![根服务器](/static/7.png)

![获取根服务器](/static/8.png)


2. 根据根服务器中的一个,获取顶级域名服务器

![顶级域名服务器](/static/9.png)

![顶级域名服务器](/static/10.png)

3. 根据顶级域名服务器,获取次级域名服务器

![次级域名服务器](/static/11.png)

![次级域名服务器](/static/12.png)

4. 根据主机与ip

![次级域名服务器](/static/13.png)

![次级域名服务器](/static/14.png)


### DNS集群 -- 实验2
在报文格式这一块,并没有做过多的约束,所以相同的报文,请求不同功能的服务器,得到的内容是不同的 

```javascript
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
// 198.41.0.4  a.root-servers.net.
// 192.26.92.30 c.gtld-servers.net.
// 220.181.33.31 ns2.baidu.com.
client.send(SendBuff,  53, '192.168.31.1',(err)=>{
    console.log('err',err)
}); 
client.send(SendBuff,  53, '198.41.0.4',(err)=>{
    console.log('err',err)
}); 
client.send(SendBuff,  53, '192.26.92.30',(err)=>{
    console.log('err',err)
}); 
client.send(SendBuff,  53, '220.181.33.31',(err)=>{
    console.log('err',err)
}); 
```
相同的请求,访问不同的服务器,获取内容不同 
![次级域名服务器](/static/15.png)

![次级域名服务器](/static/16.png)

![次级域名服务器](/static/17.png)

![次级域名服务器](/static/18.png)