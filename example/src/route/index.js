module.exports = [{
  name: 'name1',
  path: '/name1',
  component: () => import("@/pages/name1")
}, {
  name: 'name2',
  path: '/name2',
  component: () => import("@/pages/name2")
}, {
  name: 'name3',
  path: '/name3',
  component: () => import("@/pages/name3")
}, {
  name: 'name4',
  path: '/name4',
  component: () => import("@/pages/name4")
},
{
  name: 'name1',
  path: '/',
  redirect:{
    name:"name1"
  },
  component: () => import("@/pages/name1")
}]
