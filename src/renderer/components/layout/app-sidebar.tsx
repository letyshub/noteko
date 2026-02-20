import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { House, Settings, Plus, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@renderer/components/ui/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@renderer/components/ui/dropdown-menu'
import { Separator } from '@renderer/components/ui/separator'
import { ThemeToggle } from '@renderer/components/layout/theme-toggle'
import { CreateProjectDialog } from '@renderer/components/projects/create-project-dialog'
import { EditProjectDialog } from '@renderer/components/projects/edit-project-dialog'
import { DeleteProjectDialog } from '@renderer/components/projects/delete-project-dialog'
import { useProjectStore } from '@renderer/store/project-store'
import type { ProjectDto } from '@shared/types'

const navItems = [
  { title: 'Dashboard', href: '/', icon: House },
  { title: 'Settings', href: '/settings', icon: Settings },
]

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const location = useLocation()
  const projects = useProjectStore((s) => s.projects)
  const fetchProjects = useProjectStore((s) => s.fetchProjects)

  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editProject, setEditProject] = useState<ProjectDto | null>(null)
  const [deleteProject, setDeleteProject] = useState<ProjectDto | null>(null)

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <span className="px-2 text-lg font-semibold group-data-[collapsible=icon]:hidden">Noteko</span>
      </SidebarHeader>
      <Separator />
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarMenu>
            {navItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton asChild isActive={location.pathname === item.href} tooltip={item.title}>
                  <Link to={item.href}>
                    <item.icon />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Projects</SidebarGroupLabel>
          <SidebarGroupAction aria-label="New Project" onClick={() => setCreateDialogOpen(true)}>
            <Plus />
          </SidebarGroupAction>
          <SidebarMenu>
            {projects.map((project) => (
              <SidebarMenuItem key={project.id}>
                <SidebarMenuButton
                  asChild
                  isActive={location.pathname === `/projects/${project.id}`}
                  tooltip={project.name}
                >
                  <Link to={`/projects/${project.id}`}>
                    {project.color && (
                      <span
                        className="inline-block h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: project.color }}
                      />
                    )}
                    <span>{project.name}</span>
                  </Link>
                </SidebarMenuButton>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuAction showOnHover aria-label={`Actions for ${project.name}`}>
                      <MoreHorizontal />
                    </SidebarMenuAction>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="right" align="start">
                    <DropdownMenuItem onClick={() => setEditProject(project)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onClick={() => setDeleteProject(project)}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <ThemeToggle />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />

      {/* Dialogs */}
      <CreateProjectDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
      {editProject && (
        <EditProjectDialog
          open={!!editProject}
          onOpenChange={(open) => {
            if (!open) setEditProject(null)
          }}
          project={editProject}
        />
      )}
      {deleteProject && (
        <DeleteProjectDialog
          open={!!deleteProject}
          onOpenChange={(open) => {
            if (!open) setDeleteProject(null)
          }}
          project={deleteProject}
        />
      )}
    </Sidebar>
  )
}
