using GorevPanosu.Api.Data;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace GorevPanosu.Api.Tests.Data;

public sealed class PostgresModelTests
{
    [PostgresFact]
    public async Task Migration_enforces_title_limit_and_reads_utc_values_on_PostgreSQL()
    {
        var schema = "model_test_" + Guid.NewGuid().ToString("N");
        var connection = new NpgsqlConnectionStringBuilder(PostgresFactAttribute.ConnectionString)
        {
            SearchPath = schema
        };
        await using var admin = new NpgsqlConnection(PostgresFactAttribute.ConnectionString);
        await admin.OpenAsync(TestContext.Current.CancellationToken);
        await using (var create = new NpgsqlCommand($"CREATE SCHEMA \"{schema}\"", admin))
            await create.ExecuteNonQueryAsync(TestContext.Current.CancellationToken);
        try
        {
            await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
                .UseNpgsql(connection.ConnectionString).Options);
            await db.Database.MigrateAsync(TestContext.Current.CancellationToken);
            var task = new TaskItem { Title = new string('a', 120), Assignee = new Person { FullName = "Ada" } };
            task.Complete();
            db.Add(task);
            await db.SaveChangesAsync(TestContext.Current.CancellationToken);
            db.ChangeTracker.Clear();
            var saved = await db.Tasks.Include(t => t.Assignee).SingleAsync(TestContext.Current.CancellationToken);
            Assert.Equal("Ada", saved.Assignee!.FullName);
            Assert.Equal(DateTimeKind.Utc, saved.CreatedAt.Kind);
            Assert.Equal(DateTimeKind.Utc, saved.CompletedAt!.Value.Kind);
            db.Tasks.Add(new TaskItem { Title = new string('a', 121) });
            await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync(TestContext.Current.CancellationToken));
        }
        finally
        {
            await using var drop = new NpgsqlCommand($"DROP SCHEMA \"{schema}\" CASCADE", admin);
            await drop.ExecuteNonQueryAsync();
        }
    }
}
