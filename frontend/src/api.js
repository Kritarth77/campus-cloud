import axios from 'axios'

const api = axios.create({
  baseURL: 'http://localhost:8000',
})

export const getDeployments = () =>
  api.get('/deployments').then((response) => response.data)

export const createDeployment = (name, repoUrl) =>
  api.post('/deployments', { name, repo_url: repoUrl }).then((response) => response.data)

export const getLogs = (id) =>
  api.get(`/deployments/${id}/logs`).then((response) => response.data)

export const restartDeployment = (id) =>
  api.post(`/deployments/${id}/restart`).then((response) => response.data)

export const deleteDeployment = (id) =>
  api.delete(`/deployments/${id}`)
