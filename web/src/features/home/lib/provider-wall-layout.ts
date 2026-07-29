/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

export const providerWallLayoutClasses = {
  grid: 'bg-border mt-12 grid grid-cols-2 gap-px overflow-hidden rounded-3xl border sm:grid-cols-4 lg:grid-cols-5',
  item: 'group bg-background relative flex min-h-32 items-center justify-center p-5 outline-none transition-colors duration-200 hover:bg-indigo-50/80 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 dark:hover:bg-indigo-500/10',
} as const
