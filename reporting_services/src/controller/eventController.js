import { Event } from "../model/Event.model.js";
import dayjs from "dayjs";


const eventController = async (req, res) => {
  const site_id = req.query.site_id;
  const dateStr = req.query.date; // optional YYYY-MM-DD

  if (!site_id)
    return res.status(400).json({ success: false, error: "site_id required" });

  try {
    // Build match filter
    const match = { site_id: site_id };

    if (dateStr) {
      // parse date range for that day (UTC)
      const start = dayjs(dateStr).startOf("day").toDate();
      const end = dayjs(dateStr).endOf("day").toDate();
      match.timestamp = { $gte: start, $lte: end };
    }

    const pipeline = [
      { $match: match },
      {
        $facet: {
          total_views: [{ $count: "count" }],
          unique_users: [
            { $match: { user_id: { $ne: null } } },
            { $group: { _id: "$user_id" } },
            { $count: "count" },
          ],
          top_paths: [
            { $group: { _id: "$path", views: { $sum: 1 } } },
            { $sort: { views: -1 } },
            { $limit: 10 },
          ],
        },
      },
    ];

    const [result] = await Event.aggregate(pipeline).allowDiskUse(true);

    const totalViews =
      (result.total_views[0] && result.total_views[0].count) || 0;
    const uniqueUsers =
      (result.unique_users[0] && result.unique_users[0].count) || 0;
    const topPaths = (result.top_paths || []).map((p) => ({
      path: p._id,
      views: p.views,
    }));

    return res.json({
      site_id,
      date: dateStr || null,
      total_views: totalViews,
      unique_users: uniqueUsers,
      top_paths: topPaths,
    });
  } catch (err) {
    console.error("Stats error", err);
    return res.status(500).json({ success: false, error: "internal error" });
  }
};


export default eventController;
