import { Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './guards/ProtectedRoute'
import { GuestRoute } from './guards/GuestRoute'
import { appRoutes, fallbackRoute, type RouteDefinition } from './routeConfig'

function renderRouteElement(route: RouteDefinition) {
  const PageComponent = route.component
  const routeElement = (
    <Suspense fallback={null}>
      <PageComponent />
    </Suspense>
  )

  if (route.isProtected) {
    return <ProtectedRoute>{routeElement}</ProtectedRoute>
  }

  if (route.isGuestOnly) {
    return <GuestRoute>{routeElement}</GuestRoute>
  }

  return routeElement
}

export function AppRouter() {
  return (
    <Routes>
      {appRoutes.map((route) => (
        <Route key={route.path} path={route.path} element={renderRouteElement(route)} />
      ))}
      <Route path={fallbackRoute.path} element={renderRouteElement(fallbackRoute)} />
    </Routes>
  )
}
