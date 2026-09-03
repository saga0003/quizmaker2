from pathlib import Path

p = Path('src/components/institution-analytics/institution-analytics-workspace.tsx')
s = p.read_text()
imp = "import { InstitutionMobileCards } from '@/components/institution-analytics/institution-mobile-cards';\n"
anchor = "import './institution-analytics.css';\n"
if imp not in s:
    if anchor not in s:
        raise SystemExit('import anchor missing')
    s = s.replace(anchor, imp + anchor, 1)

replacements = [
    (
        '    <Card className="institution-table-card"><Table className="min-w-[1180px]">',
        '    <InstitutionMobileCards rows={rows.map((row) => ({ id: row.id, title: row.name, subtitle: `${row.city || \'Location pending\'} · ${row.board || \'Board pending\'}`, badge: `#${row.rank}`, metrics: [{ label: \'Students\', value: row.totalStudents }, { label: \'Tests\', value: row.completedTests }, { label: \'Average\', value: percentage(row.averagePercentage) }, { label: \'Participation\', value: percentage(row.participation) }], onOpen: () => onOpen(row) }))} emptyMessage="No live schools found." />\n    <Card className="institution-table-card hidden md:block"><Table className="min-w-[1180px]">',
        'schools',
    ),
    (
        '    <Card className="institution-table-card"><Table className="min-w-[960px]">',
        '    <InstitutionMobileCards rows={rows.map((row) => ({ id: row.id, title: row.name, badge: `#${row.rank}`, metrics: [{ label: \'Students\', value: row.studentCount }, { label: \'Tests\', value: row.completedTests }, { label: \'Average\', value: percentage(row.averagePercentage) }, { label: \'Participation\', value: percentage(row.participation) }], onOpen: () => onOpen(row) }))} emptyMessage={empty} />\n    <Card className="institution-table-card hidden md:block"><Table className="min-w-[960px]">',
        'hierarchy',
    ),
    (
        '    <Card className="institution-table-card"><Table className="min-w-[1120px]">',
        '    <InstitutionMobileCards rows={rows.map((row) => ({ id: row.id, title: row.name, subtitle: `${row.academicYear} · ${row.code || \'No class code\'}`, badge: `#${row.rank}`, metrics: [{ label: \'Students\', value: row.studentCount }, { label: \'Tests\', value: row.completedTests }, { label: \'Average\', value: percentage(row.averagePercentage) }, { label: \'Participation\', value: percentage(row.participation) }], onOpen: () => onOpen(row) }))} emptyMessage="No classes found." />\n    <Card className="institution-table-card hidden md:block"><Table className="min-w-[1120px]">',
        'classes',
    ),
    (
        '      <Card className="institution-table-card"><Table className="min-w-[1050px]">',
        '      <InstitutionMobileCards rows={students.map((row) => ({ id: row.id, title: row.name, subtitle: row.sectionName, badge: row.rank ? `#${row.rank}` : undefined, metrics: [{ label: \'Tests\', value: row.completedTests }, { label: \'Average\', value: percentage(row.averagePercentage) }, { label: \'Accuracy\', value: percentage(row.accuracy) }, { label: \'Last test\', value: shortDate(row.lastTestAt) }], onOpen: () => onStudent(row) }))} emptyMessage="No students in this class." />\n      <Card className="institution-table-card hidden md:block"><Table className="min-w-[1050px]">',
        'class students',
    ),
    (
        '    <Card className="institution-table-card"><Table><TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Tests</TableHead><TableHead>Average</TableHead><TableHead>Accuracy</TableHead><TableHead /></TableRow></TableHeader>',
        '    <InstitutionMobileCards rows={students.map((row) => ({ id: row.id, title: row.name, subtitle: row.sectionName, metrics: [{ label: \'Tests\', value: row.completedTests }, { label: \'Average\', value: percentage(row.averagePercentage) }, { label: \'Accuracy\', value: percentage(row.accuracy) }], onOpen: () => onStudent(row) }))} emptyMessage="No students in scope." />\n    <Card className="institution-table-card hidden md:block"><Table><TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Tests</TableHead><TableHead>Average</TableHead><TableHead>Accuracy</TableHead><TableHead /></TableRow></TableHeader>',
        'topic students',
    ),
]

for old, new, label in replacements:
    if new in s:
        continue
    if old not in s:
        raise SystemExit(f'{label} anchor missing')
    s = s.replace(old, new, 1)

p.write_text(s)
print('H8 guarded source patch applied.')
