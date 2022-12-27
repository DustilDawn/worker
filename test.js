// create an sample fastify app
const fastify = require('fastify')()

fastify.get('/', (req, reply) => {
    reply.send({ hello: 'world' })
});

// listen
fastify.listen(3000, (err) => {
    if (err) throw err
    console.log(`server listening on ${fastify.server.address().port}`)
}
)