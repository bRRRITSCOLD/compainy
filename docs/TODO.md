1. Tanstack start over next.js, update all skills that refer to next.js and replace with tanstack start info and best practices
2. We should be doing playwright testing too. This means we should also update tdd to have uni, integration, and e2e testing
    * unit testing - `*.unit.test.[ts/go]`
    * integration testing - `*.integration.test.[ts/go]` usually putting multiple pieces of code together that integrate together - usually the level where dbs are tested that can be (docker), third partey services can be tested (aws floci, http interceptors for 3rd patry apis that dont expose docker, etc) - server side its using something liker super test to call your server, you seed data into local dbs, services, etc
    * e2e testing - `*.e2e.test.[ts/go]`usally full apps or sdks, http sdk to an api - it calls the api in its own code base, ui uses playwright again ui (localhost for now)
    * all - all tests have a before all, before each, after each, after all setup in their files even if empty just so we keep the pattern upfront for set up and teardown at any level
3. Tailwindcss + cva on the front
4. tanstack form when possible - should be usable with shadcn ui
5. nuqs for query state
6. zod for validation - front end and back end
7. fastify preferred for node, gin preffered for golang, axum for rust on backend
8. Systems Engineer or Software/Systems Architect agent, or both?
9. Data architect agent that knows about databases, (sql, nosql, vector, anything) that can help with domain modeling too?