/**
 * Stats queries for the dashboard overview.
 */
import { query } from "@/lib/db";

export type DashboardStats = {
  totalCustomers: number;
  totalReservations: { today: number; week: number; month: number };
  totalOrders: { today: number; week: number; month: number };
  revenue: { today: number; week: number; month: number; total: number };
  messagesSent: { today: number; week: number };
  topCustomers: Array<{ id: number; name: string; total_spent: string; total_orders: number }>;
  recentActivity: Array<{
    id: number;
    customer_name: string;
    type: "reservation" | "order";
    created_at: string;
    status: string;
    total_amount?: string;
  }>;
  revenueDaily: Array<{ day: string; amount: number }>; // last 30 days, ascending
};

export async function getDashboardStats(): Promise<DashboardStats> {
  const [
    customers,
    reservationsToday,
    reservationsWeek,
    reservationsMonth,
    ordersToday,
    ordersWeek,
    ordersMonth,
    revenueToday,
    revenueWeek,
    revenueMonth,
    revenueTotal,
    messagesToday,
    messagesWeek,
    revenueDaily,
    top,
    recent,
  ] = await Promise.all([
    query<Array<{ c: number }>>("SELECT COUNT(*) AS c FROM customers"),
    query<Array<{ c: number }>>("SELECT COUNT(*) AS c FROM reservations WHERE DATE(reservation_date) = CURDATE()"),
    query<Array<{ c: number }>>("SELECT COUNT(*) AS c FROM reservations WHERE reservation_date >= (NOW() - INTERVAL 7 DAY)"),
    query<Array<{ c: number }>>("SELECT COUNT(*) AS c FROM reservations WHERE reservation_date >= (NOW() - INTERVAL 30 DAY)"),
    query<Array<{ c: number }>>("SELECT COUNT(*) AS c FROM orders WHERE DATE(created_at) = CURDATE()"),
    query<Array<{ c: number }>>("SELECT COUNT(*) AS c FROM orders WHERE created_at >= (NOW() - INTERVAL 7 DAY)"),
    query<Array<{ c: number }>>("SELECT COUNT(*) AS c FROM orders WHERE created_at >= (NOW() - INTERVAL 30 DAY)"),
    query<Array<{ s: string | number }>>("SELECT COALESCE(SUM(total_amount), 0) AS s FROM orders WHERE DATE(created_at) = CURDATE() AND status != 'cancelled'"),
    query<Array<{ s: string | number }>>("SELECT COALESCE(SUM(total_amount), 0) AS s FROM orders WHERE created_at >= (NOW() - INTERVAL 7 DAY) AND status != 'cancelled'"),
    query<Array<{ s: string | number }>>("SELECT COALESCE(SUM(total_amount), 0) AS s FROM orders WHERE created_at >= (NOW() - INTERVAL 30 DAY) AND status != 'cancelled'"),
    query<Array<{ s: string | number }>>("SELECT COALESCE(SUM(total_spent), 0) AS s FROM customers"),
    query<Array<{ c: number }>>("SELECT COUNT(*) AS c FROM messages WHERE DATE(created_at) = CURDATE()"),
    query<Array<{ c: number }>>("SELECT COUNT(*) AS c FROM messages WHERE created_at >= (NOW() - INTERVAL 7 DAY)"),
    query<Array<{ day: string; amount: number }>>(
      `SELECT DATE(created_at) AS day, COALESCE(SUM(total_amount), 0) AS amount
       FROM orders
       WHERE created_at >= (NOW() - INTERVAL 30 DAY) AND status != 'cancelled'
       GROUP BY DATE(created_at)
       ORDER BY day ASC`
    ),
    query<Array<{ id: number; name: string; total_spent: string; total_orders: number }>>(
      "SELECT id, name, total_spent, total_orders FROM customers ORDER BY total_spent DESC LIMIT 5"
    ),
    query<Array<{ id: number; customer_name: string; type: string; created_at: string; status: string; total_amount: string | null }>>(
      `SELECT id, customer_name, type, created_at, status, total_amount FROM (
         SELECT r.id, c.name AS customer_name, 'reservation' AS type, r.created_at, r.status, NULL AS total_amount
         FROM reservations r INNER JOIN customers c ON c.id = r.customer_id
         UNION ALL
         SELECT o.id, c.name AS customer_name, 'order' AS type, o.created_at, o.status, o.total_amount
         FROM orders o INNER JOIN customers c ON c.id = o.customer_id
       ) AS activity
       ORDER BY created_at DESC LIMIT 10`
    ),
  ]);

  return {
    totalCustomers: customers[0]?.c ?? 0,
    totalReservations: {
      today: reservationsToday[0]?.c ?? 0,
      week: reservationsWeek[0]?.c ?? 0,
      month: reservationsMonth[0]?.c ?? 0,
    },
    totalOrders: {
      today: ordersToday[0]?.c ?? 0,
      week: ordersWeek[0]?.c ?? 0,
      month: ordersMonth[0]?.c ?? 0,
    },
    revenue: {
      today: Number(revenueToday[0]?.s ?? 0),
      week: Number(revenueWeek[0]?.s ?? 0),
      month: Number(revenueMonth[0]?.s ?? 0),
      total: Number(revenueTotal[0]?.s ?? 0),
    },
    messagesSent: {
      today: messagesToday[0]?.c ?? 0,
      week: messagesWeek[0]?.c ?? 0,
    },
    topCustomers: top,
    recentActivity: recent as DashboardStats["recentActivity"],
    revenueDaily: (revenueDaily ?? []).map((r) => ({
      day: String(r.day),
      amount: Number(r.amount),
    })),
  };
}
