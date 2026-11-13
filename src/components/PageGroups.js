'use client'

import { useState } from 'react'
import GroupPager from './GroupPager'

// The admin's pages table, one group of four at a time with Previous/Next
// (the traffic page shows the same groups). groups is an array of arrays of
// <tr> rows.
export default function PageGroups({ groups, head }) {
  const [index, setIndex] = useState(0)
  const current = groups[Math.min(index, groups.length - 1)] || []

  return (
    <>
      <div className="overflow-x-auto"><table className="w-full text-sm">
        {head}
        <tbody>{current}</tbody>
      </table></div>
      <GroupPager index={index} count={groups.length} onChange={setIndex} />
    </>
  )
}
