const express = require("express");
const router = express.Router();
const authenController = require("../controllers/authenController");
const teacherController = require("../controllers/teacherController");
const classController = require("../controllers/classController");
const subjectController = require("../controllers/subjectController");
const weekController = require("../controllers/weekController");
const teachingRecordsController = require("../controllers/teachingRecordsController");
const reportsController = require("../controllers/reportsController");
const schoolYearController = require("../controllers/schoolYearController");
const authMiddleware = require("../middleware/authMiddleware");
const multer = require("multer");

router.get("/", (req, res) => {
  res.json({
    message: "Backend đang chạy!",
    timestamp: new Date().toISOString(),
  });
});

const upload = multer({ storage: multer.memoryStorage() });

router.post("/auth/register", authenController.register);
router.post("/auth/login", authenController.login);
router.post("/auth/token/verify", authenController.verifyToken);
router.post("/auth/logout", authMiddleware, authenController.logout);
router.post(
  "/auth/token/refresh",
  authMiddleware,
  authenController.refreshToken
);
router.delete(
  "/auth/token/revoke",
  authMiddleware,
  authenController.revokeToken
);
router.get("/auth/me", authMiddleware, authenController.getProfile);
router.patch(
  "/auth/me/password",
  authMiddleware,
  authenController.changePassword
);
router.delete("/auth/me", authMiddleware, authenController.deleteUser);

//teachers
router.get("/teachers", authMiddleware, teacherController.getTeachers);
router.get("/teachers/:id", authMiddleware, teacherController.getTeacherById);
router.post("/teachers", authMiddleware, teacherController.createTeacher);
router.put("/teachers/:id", authMiddleware, teacherController.updateTeacher);
router.delete("/teachers/:id", authMiddleware, teacherController.deleteTeacher);
router.post(
  "/teachers/import",
  authMiddleware,
  upload.single("file"),
  teacherController.importTeachers
);

//classes
router.get("/classes", authMiddleware, classController.getClasses);
router.get("/classes/:id", authMiddleware, classController.getClassById);
router.post("/classes", authMiddleware, classController.createClass);
router.put("/classes/:id", authMiddleware, classController.updateClass);
router.delete("/classes/:id", authMiddleware, classController.deleteClass);
router.post(
  "/classes/import",
  authMiddleware,
  upload.single("file"),
  classController.importClasses
);

//subjects
router.get("/subjects", authMiddleware, subjectController.getSubjects);
router.post("/subjects", authMiddleware, subjectController.createSubject);
router.delete("/subjects/:id", authMiddleware, subjectController.deleteSubject);

//weeks
router.get("/weeks", authMiddleware, weekController.getWeeks);
router.post("/weeks", authMiddleware, weekController.createWeek);
router.put("/weeks/:id", authMiddleware, weekController.updateWeek);
router.delete("/weeks/:id", authMiddleware, weekController.deleteWeek);

//teaching-records
router.get(
  "/teaching-records",
  authMiddleware,
  teachingRecordsController.getTeachingRecords
);
router.post(
  "/teaching-records",
  authMiddleware,
  teachingRecordsController.createTeachingRecord
);
router.delete(
  "/teaching-records/:id",
  authMiddleware,
  teachingRecordsController.deleteTeachingRecord
);

//reports
router.get(
  "/reports/teacher/:id",
  authMiddleware,
  reportsController.getTeacherReport
);
router.get(
  "/reports/export/month",
  authMiddleware,
  reportsController.exportMonthReport
);
router.get(
  "/reports/export/week",
  authMiddleware,
  reportsController.exportWeekReport
);
router.get(
  "/reports/export/semester",
  authMiddleware,
  reportsController.exportSemesterReport
);
router.get(
  "/reports/export/year",
  authMiddleware,
  reportsController.exportYearReport
);

router.get("/school-years", authMiddleware, schoolYearController.getSchoolYears);
router.get("/school-years/active", authMiddleware, schoolYearController.getActiveSchoolYear);
router.get("/school-years/:year", authMiddleware, schoolYearController.getSchoolYearData);
router.post("/school-years", authMiddleware, schoolYearController.createSchoolYear);
router.post("/school-years/finish", authMiddleware, schoolYearController.finishSchoolYear);
router.delete("/school-years/:year", authMiddleware, schoolYearController.deleteSchoolYear);

module.exports = router;
