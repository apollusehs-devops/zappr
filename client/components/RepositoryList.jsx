import React, { Component, PropTypes } from 'react'
import { Button, Panel, ListGroup, ListGroupItem, Input } from 'react-bootstrap'
import fuzzysearch from 'fuzzysearch'
import RepositoryListItem from './RepositoryListItem.jsx'
import classes from 'classnames'

export default class RepositoryList extends Component {
  static propTypes = {
    selected: PropTypes.string,
    repositories: PropTypes.object.isRequired,
    isUpdating: PropTypes.bool,
    filterBy: PropTypes.string.isRequired,
    filterRepos: PropTypes.func.isRequired,
    fetchAll: PropTypes.func.isRequired
  }

  static defaultProps = {
    repositories: {},
    filterBy: '',
    isUpdating: true
  }

  onFetchAll() {
    this.props.fetchAll(true)
  }

  updateSearch(evt) {
    this.props.filterRepos(evt.target.value)
  }

  filteredRepositories() {
    return Object.keys(this.props.repositories)
                 .filter(key => fuzzysearch(this.props.filterBy, key))
                 .map(key => this.props.repositories[key])
  }

  sortedRepositories() {
    return this.filteredRepositories().sort((a, b) => {
      a = a.full_name.toLowerCase()
      b = b.full_name.toLowerCase()
      return a < b ? -1 : (b < a ? 1 : 0)
    })
  }

  repositoryCount() {
    return Object.keys(this.props.repositories).length
  }

  render() {
    const {selected, isUpdating, filterBy} = this.props
    const repos = this.sortedRepositories()

    const header = <header>
      Repositories {isUpdating ? <i className='fa fa-refresh fa-spin'/> : `(${this.repositoryCount()})`}
    </header>

    return (
      <Panel collapsible defaultExpanded header={header}>
        <Input type='search'
               value={filterBy}
               onChange={this.updateSearch.bind(this)}
               placeholder='zalando/zappr'
               label={'Search for a repository'}/>
        <ListGroup componentClass="ul">
          {repos.length > 0
            ? repos.map((repo, i) =>
            <RepositoryListItem key={i} repository={repo} active={repo.full_name === selected}/>)
            : <ListGroupItem>Oops, no repository found! Try the button below, it could help.</ListGroupItem>}
        </ListGroup>
        <Button
          style={{width: '100%'}}
          disabled={isUpdating}
          onClick={this.onFetchAll.bind(this)}
          bsStyle='primary' lg>
          <i className={classes('fa', 'fa-refresh', {'fa-spin': isUpdating})}/>&nbsp;Sync with Github
        </Button>
      </Panel>
    )
  }
}
