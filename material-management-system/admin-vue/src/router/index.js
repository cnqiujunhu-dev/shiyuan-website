import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue'),
    meta: { guest: true }
  },
  {
    path: '/',
    component: () => import('../views/Layout.vue'),
    meta: { requiresAdmin: true },
    children: [
      {
        path: '',
        redirect: '/dashboard'
      },
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('../views/Dashboard.vue')
      },
      {
        path: 'items',
        name: 'Items',
        component: () => import('../views/Items.vue')
      },
      {
        path: 'items/new',
        name: 'ItemNew',
        component: () => import('../views/ItemForm.vue')
      },
      {
        path: 'items/:id/edit',
        name: 'ItemEdit',
        component: () => import('../views/ItemForm.vue')
      },
      {
        path: 'items/:id/ownerships',
        name: 'ItemOwnerships',
        component: () => import('../views/ItemOwnerships.vue')
      },
      {
        path: 'transactions',
        name: 'Transactions',
        component: () => import('../views/Transactions.vue')
      },
      {
        path: 'transactions/import',
        name: 'TransactionImport',
        component: () => import('../views/TransactionImport.vue')
      },
      {
        path: 'vip/customers',
        name: 'VipCustomers',
        component: () => import('../views/VipCustomers.vue')
      },
      {
        path: 'vip/levels',
        name: 'VipLevels',
        component: () => import('../views/VipLevels.vue')
      },
      {
        path: 'vip/import',
        name: 'VipImport',
        component: () => import('../views/VipImport.vue')
      },
      {
        path: 'users',
        name: 'Users',
        component: () => import('../views/Users.vue')
      },
      {
        path: 'users/:id',
        name: 'UserDetail',
        component: () => import('../views/UserDetail.vue')
      },
      {
        path: 'applications',
        name: 'Applications',
        component: () => import('../views/Applications.vue')
      },
      {
        path: 'transfers',
        name: 'Transfers',
        component: () => import('../views/Transfers.vue')
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const auth = useAuthStore()

  if (to.meta.requiresAdmin) {
    if (!auth.isLoggedIn || !auth.isAdmin) {
      next('/login')
      return
    }
  }

  if (to.meta.guest && auth.isLoggedIn && auth.isAdmin) {
    next('/dashboard')
    return
  }

  next()
})

export default router
