const express = require("express");

const router = express.Router();

const Notification =
  require("../models/Notification");


// =====================================================
// GET ALL NOTIFICATIONS
// =====================================================

router.get(
  "/",
  async (req, res) => {

    try {

      const notifications =
        await Notification.find()
          .sort({
            createdAt: -1,
          })
          .lean();


      const formattedNotifications =
        notifications.map(
          (notification) => ({

            ...notification,

            // Support both fields
            read:
              notification.read === true ||
              notification.isRead === true,

          })
        );


      res.status(200).json(
        formattedNotifications
      );


    } catch (error) {

      console.error(
        "❌ Get Notifications Error:",
        error
      );


      res.status(500).json({

        message:
          "Failed to fetch notifications",

        error:
          error.message,

      });

    }

  }
);


// =====================================================
// MARK ONE NOTIFICATION AS READ
// =====================================================

router.put(
  "/:id/read",
  async (req, res) => {

    try {

      const notification =
        await Notification.findByIdAndUpdate(

          req.params.id,

          {
            read: true,
            isRead: true,
          },

          {
            new: true,
          }

        );


      if (!notification) {

        return res.status(404).json({

          message:
            "Notification not found",

        });

      }


      res.status(200).json({

        message:
          "Notification marked as read",

        notification,

      });


    } catch (error) {

      console.error(
        "❌ Mark Read Error:",
        error
      );


      res.status(500).json({

        message:
          "Failed to mark notification as read",

        error:
          error.message,

      });

    }

  }
);


// =====================================================
// MARK ALL NOTIFICATIONS AS READ
// =====================================================

router.put(
  "/read-all",
  async (req, res) => {

    try {

      await Notification.updateMany(

        {},

        {
          $set: {
            read: true,
            isRead: true,
          },
        }

      );


      res.status(200).json({

        message:
          "All notifications marked as read",

      });


    } catch (error) {

      console.error(
        "❌ Mark All Read Error:",
        error
      );


      res.status(500).json({

        message:
          "Failed to mark all notifications as read",

        error:
          error.message,

      });

    }

  }
);


// =====================================================
// DELETE NOTIFICATION
// =====================================================

router.delete(
  "/:id",
  async (req, res) => {

    try {

      const deletedNotification =
        await Notification.findByIdAndDelete(
          req.params.id
        );


      if (!deletedNotification) {

        return res.status(404).json({

          message:
            "Notification not found",

        });

      }


      res.status(200).json({

        message:
          "Notification deleted successfully",

      });


    } catch (error) {

      console.error(
        "❌ Delete Notification Error:",
        error
      );


      res.status(500).json({

        message:
          "Failed to delete notification",

        error:
          error.message,

      });

    }

  }
);


module.exports = router;