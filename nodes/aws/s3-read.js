module.exports = function(RED) {

    const { S3Client, GetObjectCommand, GetObjectTaggingCommand } = require("@aws-sdk/client-s3");
    const mustache = require('mustache');

    const getTags = async (client, key, bucket) => {
        const message = new GetObjectTaggingCommand({
            Key: key,
            Bucket: bucket,
        });

        try {
            const response = await client.send(message);
            return response.TagSet.map(({Key, Value}) => ({[Key]: Value}));
        } catch (e) {
            console.log('error tags', e);
        }

        return [];
    }

    function S3GetObject(props) {
        RED.nodes.createNode(this, props);

        const awsConfig = RED.nodes.getNode(props.aws);

        this.name = props.name;
        this.bucket = props.bucket;
        this.filename = props.filename;
        this.property = props.property;
        this.withTags = props.withTags;
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

        node.on('input', async function(msg, send, done) {
            const key = mustache.render(node.filename, msg);
            const bucket = mustache.render(node.bucket, msg);

            const s3Object = new GetObjectCommand({
                Key: key,
                Bucket: bucket,
            });

            try {
                const response = await client.send(s3Object);
                const stringBody = await response.Body.transformToString();

                const isJson = response.ContentType === 'application/json';
                const fileContent = isJson ? JSON.parse(stringBody): stringBody;

                RED.util.setMessageProperty(msg, node.property, fileContent);

                if (node.withTags) {
                    const tags = await getTags(client, key, bucket);

                    RED.util.setMessageProperty(msg, 'tags', tags);
                }

                send([msg, null]);
            } catch (error) {
                send([null, {error, details: { Key: key,  Bucket: bucket, }}]);
            }

            done();
        });
    }

    RED.nodes.registerType('aws-cloud-s3-read', S3GetObject);
}