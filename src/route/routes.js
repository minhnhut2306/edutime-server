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
const isAdmin = require("../middleware/isAdmin.middleware");

const upload = multer({ storage: multer.memoryStorage() });

router.get("/", (req, res) => {
  res.json({
    message: "Backend đang chạy!",
    timestamp: new Date().toISOString(),
  });
});

router.post("/auth/register", authenController.register);
router.post("/auth/login", authenController.login);
router.post("/auth/token/verify", authenController.verifyToken);
router.post("/auth/logout", authMiddleware, authenController.logout);
router.post("/auth/token/refresh", authMiddleware, authenController.refreshToken);
router.delete("/auth/token/revoke", authMiddleware, authenController.revokeToken);
router.get("/auth", authMiddleware, isAdmin, authenController.getAllUsers);
router.get("/auth/me", authMiddleware, authenController.getProfile);
router.patch("/auth/me/password", authMiddleware, authenController.changePassword);
router.put("/auth/:userId/role", authMiddleware, isAdmin, authenController.updateUserRole);
router.delete("/auth/:userId", authMiddleware, isAdmin, authenController.deleteUserById);
router.delete("/auth/me", authMiddleware, authenController.deleteUser);

router.get("/teachers", authMiddleware, teacherController.getTeachers);
router.get("/teachers/:id", authMiddleware, teacherController.getTeacherById);
router.post("/teachers", authMiddleware, teacherController.createTeacher);
router.put("/teachers/:id", authMiddleware, teacherController.updateTeacher);
router.delete("/teachers/:id", authMiddleware, teacherController.deleteTeacher);
router.put("/teachers/:id/user", authMiddleware, teacherController.updateTeacherUserId);
router.post("/teachers/import", authMiddleware, upload.single("file"), teacherController.importTeachers);

router.get("/classes/grades", authMiddleware, classController.getAvailableGrades);
router.post("/classes/import", authMiddleware, upload.single("file"), classController.importClasses);
router.get("/classes", authMiddleware, classController.getClasses);
router.get("/classes/:id", authMiddleware, classController.getClassById);
router.post("/classes", authMiddleware, classController.createClass);
router.put("/classes/:id", authMiddleware, classController.updateClass);
router.delete("/classes/:id", authMiddleware, classController.deleteClass);

router.get("/subjects", authMiddleware, subjectController.getSubjects);
router.post("/subjects", authMiddleware, subjectController.createSubject);
router.put("/subjects/:id", authMiddleware, subjectController.updateSubject);
router.delete("/subjects/:id", authMiddleware, subjectController.deleteSubject);

router.get("/weeks", authMiddleware, weekController.getWeeks);
router.post("/weeks", authMiddleware, weekController.createWeek);
router.put("/weeks/:id", authMiddleware, weekController.updateWeek);
router.delete("/weeks/:id", authMiddleware, weekController.deleteWeek);

router.get("/teaching-records", authMiddleware, teachingRecordsController.getTeachingRecords);
router.post("/teaching-records", authMiddleware, teachingRecordsController.createTeachingRecord);
router.patch("/teaching-records/:id", authMiddleware, teachingRecordsController.updateTeachingRecord);
router.delete("/teaching-records/:id", authMiddleware, teachingRecordsController.deleteTeachingRecord);

router.get("/reports/export", authMiddleware, reportsController.exportReport);
router.get("/reports/export/month", authMiddleware, reportsController.exportMonthReport);
router.get("/reports/export/week", authMiddleware, reportsController.exportWeekReport);
router.get("/reports/export/semester", authMiddleware, reportsController.exportSemesterReport);
router.get("/reports/export/year", authMiddleware, reportsController.exportYearReport);
router.get("/reports/teacher/:id", authMiddleware, reportsController.getTeacherReport);

router.get("/school-years", authMiddleware, schoolYearController.getSchoolYears);
router.get("/school-years/active", authMiddleware, schoolYearController.getActiveSchoolYear);
router.get("/school-years/:year", authMiddleware, schoolYearController.getSchoolYearData);
router.post("/school-years", authMiddleware, schoolYearController.createSchoolYear);
router.post("/school-years/finish", authMiddleware, schoolYearController.finishSchoolYear);
router.delete("/school-years/:year", authMiddleware, schoolYearController.deleteSchoolYear);
router.get('/school-years/:year/export', authMiddleware, isAdmin, schoolYearController.exportYearData);

module.exports = router;