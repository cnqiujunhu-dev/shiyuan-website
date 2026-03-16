import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth.js'

const routes = [
  { path: '/login', component: () => import('@/views/auth/Login.vue'), meta: { guest: true } },
  { path: '/register', component: () => import('@/views/auth/Register.vue'), meta: { guest: true } },
  { path: '/forgot-password', component: () => import('@/views/auth/ForgotPassword.vue'), meta: { guest: true } },
  {
    path: '/',
    component: () => import('@/views/Home.vue'),
    meta: { requiresAuth: true },
    redirect: '/my-assets',
    children: [
      { path: 'my-assets', component: () => import('@/views/MyAssets.vue') },
      { path: 'activities', component: () => import('@/views/Activities.vue') },
      { path: 'vip', component: () => import('@/views/VipBenefits.vue') },
      { path: 'help', component: () => import('@/views/Help.vue') },
      { path: 'shop', component: () => import('@/views/Shop.vue') },
    ]
  },
  { path: '/:pathMatch(.*)*', redirect: '/' }
]

const router = createRouter({ history: createWebHistory(), routes })

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (to.meta.requiresAuth && !auth.isLoggedIn) return '/login'
  if (to.meta.guest && auth.isLoggedIn) return '/my-assets'
})

export default router
