import { Subject, StudentMarks, CalculatedResult, SubjectResultDetail } from '../types/index.ts';

export const DEFAULT_PASS_MARK = 40;

/**
 * Calculates grade for an individual subject mark
 */
export function getSubjectGrade(mark: number | null | undefined, passMark = DEFAULT_PASS_MARK): { grade: string; status: 'PASS' | 'FAIL' | 'ABSENT' | 'PENDING' } {
  if (mark === null || mark === undefined || mark === (' ' as unknown as number) || isNaN(Number(mark))) {
    return { grade: '—', status: 'PENDING' };
  }

  const numericMark = Number(mark);
  if (numericMark < 0) return { grade: 'F', status: 'FAIL' };
  if (numericMark < passMark) return { grade: 'F', status: 'FAIL' };
  if (numericMark >= 90) return { grade: 'A+', status: 'PASS' };
  if (numericMark >= 80) return { grade: 'A', status: 'PASS' };
  if (numericMark >= 70) return { grade: 'B+', status: 'PASS' };
  if (numericMark >= 60) return { grade: 'B', status: 'PASS' };
  if (numericMark >= 50) return { grade: 'C', status: 'PASS' };
  if (numericMark >= passMark) return { grade: 'D', status: 'PASS' };

  return { grade: 'F', status: 'FAIL' };
}

/**
 * Calculates total, percentage, overall grade, and pass/fail for a student given their marks
 */
export function calculateStudentResult(
  marks: StudentMarks,
  subjects: Subject[],
  passMark = DEFAULT_PASS_MARK
): CalculatedResult {
  let totalObtained = 0;
  let totalMax = 0;
  let enteredCount = 0;
  let hasFailedSubject = false;
  const failedSubjectCodes: string[] = [];
  const subjectDetails: SubjectResultDetail[] = [];

  for (const subject of subjects) {
    const rawVal = marks[subject.id];
    const isBlank = rawVal === null || rawVal === undefined || rawVal === (' ' as unknown as number) || rawVal === ('' as unknown as number);
    const numericMark = isBlank ? null : Number(rawVal);

    totalMax += subject.maxMarks;

    if (numericMark !== null && !isNaN(numericMark)) {
      totalObtained += numericMark;
      enteredCount++;

      const subRes = getSubjectGrade(numericMark, passMark);
      if (subRes.status === 'FAIL') {
        hasFailedSubject = true;
        failedSubjectCodes.push(subject.code);
      }

      subjectDetails.push({
        subjectId: subject.id,
        code: subject.code,
        name: subject.name,
        maxMarks: subject.maxMarks,
        minMarks: subject.minMarks ?? passMark,
        marksObtained: numericMark,
        grade: subRes.grade,
        status: subRes.status,
      });
    } else {
      subjectDetails.push({
        subjectId: subject.id,
        code: subject.code,
        name: subject.name,
        maxMarks: subject.maxMarks,
        minMarks: subject.minMarks ?? passMark,
        marksObtained: null,
        grade: '—',
        status: 'PENDING',
      });
    }
  }

  const isComplete = enteredCount === subjects.length && subjects.length > 0;

  if (!isComplete) {
    return {
      totalObtained,
      totalMax,
      percentage: enteredCount > 0 ? Number(((totalObtained / (enteredCount * 100)) * 100).toFixed(2)) : null,
      grade: 'PENDING',
      status: 'PENDING',
      isComplete: false,
      failedSubjectCodes,
      subjectDetails,
    };
  }

  const percentage = Number(((totalObtained / totalMax) * 100).toFixed(2));

  let overallGrade: 'A+' | 'A' | 'B+' | 'B' | 'C' | 'D' | 'F';

  if (hasFailedSubject || percentage < passMark) {
    overallGrade = 'F';
  } else if (percentage >= 90) {
    overallGrade = 'A+';
  } else if (percentage >= 80) {
    overallGrade = 'A';
  } else if (percentage >= 70) {
    overallGrade = 'B+';
  } else if (percentage >= 60) {
    overallGrade = 'B';
  } else if (percentage >= 50) {
    overallGrade = 'C';
  } else {
    overallGrade = 'D';
  }

  const status = hasFailedSubject ? 'FAIL' : 'PASS';

  return {
    totalObtained,
    totalMax,
    percentage,
    grade: overallGrade,
    status,
    isComplete: true,
    failedSubjectCodes,
    subjectDetails,
  };
}
