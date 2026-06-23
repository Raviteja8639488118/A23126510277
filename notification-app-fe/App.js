
import React, { useState, useEffect } from 'react';
import { 
  Container, AppBar, Toolbar, Typography, Box, Card, CardContent, 
  Grid, Select, MenuItem, InputLabel, FormControl, Pagination, 
  Badge, Chip, Table, TableBody, TableCell, TableContainer, 
  TableHead, TableRow, Paper, Divider, Button
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import StarIcon from '@mui/icons-material/Star';

// Mock dataset mapping evaluation API specification for stable execution if 401 encountered
const MOCK_API_DATA = [
  { "ID": "d146095a", "Type": "Result", "Message": "mid-sem examination scores published", "Timestamp": "2026-04-22 17:51:30" },
  { "ID": "b283218f", "Type": "Placement", "Message": "CSX Corporation hiring application window active", "Timestamp": "2026-04-22 17:51:18" },
  { "ID": "81589ada", "Type": "Event", "Message": "Graduation farewell registration open", "Timestamp": "2026-04-22 17:51:06" },
  { "ID": "0005513a", "Type": "Result", "Message": "Practical mid-sem lab evaluation results ready", "Timestamp": "2026-04-22 17:50:54" },
  { "ID": "ea836726", "Type": "Result", "Message": "Final project-review documentation due", "Timestamp": "2026-04-22 17:50:42" },
  { "ID": "003cb427", "Type": "Result", "Message": "External review scheduling update", "Timestamp": "2026-04-22 17:50:30" },
  { "ID": "8a7412bd", "Type": "Placement", "Message": "Advanced Micro Devices Inc. hiring profile shortlisted", "Timestamp": "2026-04-22 17:49:42" }
];

const TYPE_WEIGHTS = { "Placement": 3, "Result": 2, "Event": 1 };

export default function App() {
  const [notifications, setNotifications] = useState(MOCK_API_DATA);
  const [viewedIds, setViewedIds] = useState(() => {
    const saved = localStorage.getItem('viewed_notif_ids');
    return saved ? JSON.parse(saved) : [];
  });
  
  // Filtering & Pagination States
  const [typeFilter, setTypeFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(5);
  const [topN, setTopN] = useState(5);

  useEffect(() => {
    localStorage.setItem('viewed_notif_ids', JSON.stringify(viewedIds));
  }, [viewedIds]);

  const markAsRead = (id) => {
    if (!viewedIds.includes(id)) {
      setViewedIds([...viewedIds, id]);
    }
  };

  const markAllAsRead = () => {
    const allIds = notifications.map(n => n.ID);
    setViewedIds(allIds);
  };

  // 1. Calculate Priority Inbox (Top 'n' sorted by weight then timestamp recency)
  const priorityInbox = [...notifications].sort((a, b) => {
    const wA = TYPE_WEIGHTS[a.Type] || 0;
    const wB = TYPE_WEIGHTS[b.Type] || 0;
    if (wB !== wA) return wB - wA;
    return new Date(b.Timestamp) - new Date(a.Timestamp);
  }).slice(0, topN);

  // 2. Filtered & Paginated General Feed
  const filteredFeed = notifications.filter(n => typeFilter === 'All' || n.Type === typeFilter);
  const pageCount = Math.ceil(filteredFeed.length / limit);
  const paginatedFeed = filteredFeed.slice((page - 1) * limit, page * limit);
  const unreadCount = notifications.filter(n => !viewedIds.includes(n.ID)).length;

  return (
    <Box sx={{ flexGrow: 1, bgcolor: '#f5f7fa', minHeight: '100vh', pb: 6 }}>
      {/* AppBar navigation element */}
      <AppBar position="static" sx={{ bgcolor: '#1a237e' }}>
        <Toolbar>
          <NotificationsIcon sx={{ mr: 2 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 'bold' }}>
            Campus Notification Hub
          </Typography>
          <Badge badgeContent={unreadCount} color="error" showZero>
            <Chip label="Unread Live Alerts" color="secondary" sx={{ fontWeight: 'bold' }} />
          </Badge>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Grid container spacing={4}>
          
          {/* LEFT PANEL: Dynamic Priority Inbox Configuration */}
          <Grid item xs={12} md={5}>
            <Card elevation={3} sx={{ borderRadius: 3, borderLeft: '6px solid #ff9100' }}>
              <CardContent>
                <Box display="flex" alignItems="center" mb={2}>
                  <StarIcon sx={{ color: '#ff9100', mr: 1 }} />
                  <Typography variant="h6" fontWeight="bold">Priority Inbox Window</Typography>
                </Box>
                
                <FormControl fullWidth size="small" sx={{ mb: 3 }}>
                  <InputLabel>Show Top 'n' Items</InputLabel>
                  <Select value={topN} label="Show Top 'n' Items" onChange={(e) => setTopN(e.target.value)}>
                    <MenuItem value={3}>Top 3 High Importance</MenuItem>
                    <MenuItem value={5}>Top 5 High Importance</MenuItem>
                    <MenuItem value={7}>Top 7 High Importance</MenuItem>
                  </Select>
                </FormControl>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {priorityInbox.map((notif) => (
                    <Paper key={`prio-${notif.ID}`} variant="outlined" sx={{ p: 2, bgcolor: '#fffde7', borderColor: '#ffe082' }}>
                      <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
                        <Chip size="small" label={notif.Type} color={notif.Type === 'Placement' ? 'error' : notif.Type === 'Result' ? 'primary' : 'default'} />
                        <Typography variant="caption" color="text.secondary">{notif.Timestamp}</Typography>
                      </Box>
                      <Typography variant="body2" fontWeight="medium">{notif.Message}</Typography>
                    </Paper>
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* RIGHT PANEL: General Paginated Feed */}
          <Grid item xs={12} md={7}>
            <Card elevation={3} sx={{ borderRadius: 3 }}>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2} mb={3}>
                  <Typography variant="h6" fontWeight="bold">Notification History Log</Typography>
                  <Button size="small" variant="outlined" color="primary" onClick={markAllAsRead}>
                    Mark All Read
                  </Button>
                </Box>

                {/* Filters Row */}
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid item xs={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Type Filter</InputLabel>
                      <Select value={typeFilter} label="Type Filter" onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}>
                        <MenuItem value="All">All Categories</MenuItem>
                        <MenuItem value="Placement">Placement</MenuItem>
                        <MenuItem value="Result">Result</MenuItem>
                        <MenuItem value="Event">Event</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Items Per Page</InputLabel>
                      <Select value={limit} label="Items Per Page" onChange={(e) => { setLimit(e.target.value); setPage(1); }}>
                        <MenuItem value={3}>3 rows</MenuItem>
                        <MenuItem value={5}>5 rows</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>

                {/* Core Data Log Table */}
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead sx={{ bgcolor: '#f0f2f5' }}>
                      <TableRow>
                        <TableCell><b>Status</b></TableCell>
                        <TableCell><b>Category</b></TableCell>
                        <TableCell><b>Log Message</b></TableCell>
                        <TableCell align="right"><b>Action</b></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {paginatedFeed.map((notif) => {
                        const isRead = viewedIds.includes(notif.ID);
                        return (
                          <TableRow key={notif.ID} sx={{ bgcolor: isRead ? 'inherit' : '#e8eaf6' }}>
                            <TableCell>
                              <Chip size="small" variant={isRead ? "outlined" : "filled"} label={isRead ? "Viewed" : "New"} color={isRead ? "default" : "secondary"} />
                            </TableCell>
                            <TableCell><b>{notif.Type}</b></TableCell>
                            <TableCell>
                              <Typography variant="body2">{notif.Message}</Typography>
                              <Typography variant="caption" color="text.secondary">{notif.Timestamp}</Typography>
                            </TableCell>
                            <TableCell align="right">
                              {!isRead && (
                                <Button size="small" variant="text" onClick={() => markAsRead(notif.ID)}>
                                  Read
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>

                {/* Pagination controls footer block */}
                <Box display="flex" justifyContent="center" mt={3}>
                  <Pagination count={pageCount} page={page} onChange={(e, value) => setPage(value)} color="primary" size="medium" />
                </Box>

              </CardContent>
            </Card>
          </Grid>

        </Grid>
      </Container>
    </Box>
  );
}