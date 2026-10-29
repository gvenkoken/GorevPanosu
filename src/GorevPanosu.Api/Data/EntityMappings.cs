using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace GorevPanosu.Api.Data;

public sealed class PersonMapping : IEntityTypeConfiguration<Person>
{
    public void Configure(EntityTypeBuilder<Person> entity)
    {
        entity.ToTable("People");
        entity.HasKey(x => x.Id);
        entity.Property(x => x.FullName).IsRequired();
    }
}

public sealed class TaskItemMapping : IEntityTypeConfiguration<TaskItem>
{
    public void Configure(EntityTypeBuilder<TaskItem> entity)
    {
        entity.ToTable("Tasks");
        entity.HasKey(x => x.Id);
        entity.Property(x => x.Title).HasMaxLength(120).IsRequired();
        entity.Property(x => x.Status).HasConversion<string>().HasMaxLength(16);
        var utc = new ValueConverter<DateTime, DateTime>(
            value => value.Kind == DateTimeKind.Utc ? value : value.ToUniversalTime(),
            value => DateTime.SpecifyKind(value, DateTimeKind.Utc));
        entity.Property(x => x.CreatedAt).HasConversion(utc).HasColumnType("timestamp with time zone");
        entity.Property(x => x.CompletedAt).HasConversion(utc).HasColumnType("timestamp with time zone");
        entity.HasOne(x => x.Assignee).WithMany().HasForeignKey(x => x.AssigneeId).OnDelete(DeleteBehavior.Restrict);
    }
}
