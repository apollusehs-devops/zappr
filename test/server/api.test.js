import nconf from 'nconf'
import supertest from 'supertest-as-promised'
import { expect } from 'chai'

import MountebankClient from '../MountebankClient'
import MockStrategy from '../passport/MockStrategy'
import { init as initApp } from '../../server/server'
import { db, Repository, Check } from '../../server/model'

import { logger } from '../../common/debug'
const log = logger('test')

describe('API', () => {
  const app = initApp({PassportStrategy: MockStrategy})
  const mountebank = new MountebankClient()
  const request = supertest.agent(app.listen())
  const imposter = {
    port: 4242,
    name: 'github'
  }

  before(async (done) => {
    // Override config values
    nconf.set('GITHUB_URL', `http://localhost:${imposter.port}`)

    try {
      // Initialize database
      await db.sync()

      // Configure mountebank
      const mb = await mountebank.start()
      await mb.imposter().
      setPort(imposter.port).
      setName(imposter.name).
      stub().
        response().
          setStatusCode(200).
          setHeader('Content-Type', 'application/json').
          setBody(require('../fixtures/github.user.repos.json')).
        add().
        predicate().
          setPath('/user/repos').
          setMethod('GET').
        add().
      add().
      create()

      // Initialize session
      request.get('/auth/github').end(done)
    } catch (err) {
      return done(err)
    }
  })

  beforeEach(done => Promise.all([
    Repository.truncate()
  ]).then(() => done()).catch(done))

  after(done => mountebank.stop().then(done).catch(done))

  describe('GET /api/repos', () => {
    it('should respond with github repos', done => {
      request
        .get('/api/repos')
        .set('Accept', 'application/json')
        .expect(200)
        .expect('Content-Type', /json/)
        .expect(({body}) => {
          expect(body).to.be.an('array').and.to.have.length.above(1)
          expect(body).to.have.deep.property('[0].id').that.is.a('number')
          expect(body).to.have.deep.property('[0].name').that.is.a('string')
          expect(body).to.have.deep.property('[0].checks').that.is.a('array')
        })
        .end(done)
    })

    it('should cache the response in the database', async (done) => {
      try {
        const {body} = await request.get('/api/repos')
        const user = MockStrategy.props.user
        // Load repos from the database and transform
        // them into a format equal to the HTTP response.
        const repos = await Repository.userScope(user)
          .findAllSorted({include: [Check]})
          .then(repos => repos.map(r => r.flatten()))
          .then(repos => repos.map(r => JSON.stringify(r)))
          .then(repos => repos.map(r => JSON.parse(r)))

        expect(repos).to.have.length.above(0)
        expect(body).to.have.length.above(0)
        expect(repos).to.deep.include.members(body)
        done()
      } catch (err) {
        return done(err)
      }
    })

    it('should refresh github repos', async (done) => {
      try {
        const repos0 = (await request.get('/api/repos')).body
        expect(repos0).to.have.property('length', 2)

        await Repository.destroy({where: {id: repos0[0].id}})

        const repos1 = (await request.get('/api/repos')).body
        expect(repos1).to.have.property('length', 1)

        const repos2 = (await request.get('/api/repos?refresh=true')).body
        expect(repos2).to.have.property('length', 2)
        done()
      } catch (err) {
        return done(err)
      }
    })
  })

  describe('PUT /api/repos/:id', () => {
    it('should create a new check and enable Zappr', async (done) => {
      try {
        // Fetch repositories
        const repos = (await request.get('/api/repos').expect(200)).body
        const id = repos[0].id

        // Enable Zappr
        const repo0 = (await request
          .put(`/api/repos/${id}`)
          .send({zapprEnabled: true})
          .expect(202)
          .expect('Content-Type', /json/))
          .body

        expect(repo0).to.be.an('object')
        expect(repo0).to.have.property('checks')
          .and.to.be.an('Array')
          .and.to.have.property('length', 1)

        // Disable Zappr
        const repo1 = (await request
          .put(`/api/repos/${id}`)
          .send({zapprEnabled: false})
          .expect(202)
          .expect('Content-Type', /json/))
          .body

        expect(repo1).to.be.an('object')
        expect(repo1).to.have.property('checks')
          .and.to.be.an('Array')
          .and.to.have.property('length', 0)

        done()
      } catch (e) {
        done(e)
      }
    })
  })
})