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

export const authLayoutClasses = {
  root: 'relative min-h-svh overflow-hidden bg-background lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(440px,0.9fr)]',
  showcase:
    'relative hidden min-h-svh overflow-hidden border-r lg:flex lg:flex-col',
  formPanel:
    'relative flex min-h-svh min-w-0 items-center justify-center overflow-y-auto px-4 pt-24 pb-20 sm:px-8 lg:px-12 lg:pt-20',
} as const
