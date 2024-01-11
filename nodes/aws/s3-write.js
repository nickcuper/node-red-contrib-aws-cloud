module.exports = function(RED) {

    const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
    const { Buffer } = require('node:buffer');
    const mustache = require('mustache');

    function S3PutObject(props) {
        RED.nodes.createNode(this, props);

        const awsConfig = RED.nodes.getNode(props.aws);

        this.name = props.name;
        this.bucket = props.bucket;
        this.filename = props.filename;
        this.property = props.property;
        this.contentType = props.contentType;
        this.retries = props.retries || 5;
        this.tags = props.tags;

        const node = this;

        const client = new S3Client({
            region: awsConfig.region,
            credentials: {
                accessKeyId: awsConfig.accessKey,
                secretAccessKey: awsConfig.secretKey,
            },
            maxAttempts: props.retries,
        });

        node.on('input', function(msg, send, done) {
            const s3Content = RED.util.getMessageProperty(msg, node.property);
            if (s3Content === undefined) {
                send([null, `Cant find property name ${node.property} in msg object`]);
                done();

                return;
            }

            const tagBuilder = new URLSearchParams('')
            node.tags.forEach((tag) => {
                tagBuilder.set(tag.key, mustache.render(tag.value, msg));
            });

            const sanitizedContent = typeof s3Content === 'string' ? s3Content : JSON.stringify(s3Content);

            const body = Buffer.from(sanitizedContent, 'utf8');
            const key = mustache.render(node.filename, msg);
            const bucket = mustache.render(node.bucket, msg);
            const contentType = mustache.render(node.contentType, msg);

            const s3Object = new PutObjectCommand({
                Body: body,
                Key: key,
                Bucket: bucket,
                ContentType: contentType,
                Tagging: tagBuilder.toString()
            });

            client.send(s3Object).then((response) => {
                send([{
                    ...msg,
                    's3Response': response,
                }, null]);
                done();
            }).catch((error) => {
                send([null, error]);
                done();
            });
        });
    }

    RED.nodes.registerType('aws-cloud-s3-write', S3PutObject);
}