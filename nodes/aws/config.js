module.exports = function(RED) {
    function AWSConfigNode(props) {
        RED.nodes.createNode(this, props);

        this.accessKey = this.credentials.accessKey;
        this.secretKey = this.credentials.secretKey;

        this.region = props.region;
        this.name = props.name;
    }

    const props = {
        credentials: {
            accessKey: {type: 'text'},
            secretKey: {type: 'password'}
        }
    };

    RED.nodes.registerType('aws-cloud-config', AWSConfigNode, props);
}